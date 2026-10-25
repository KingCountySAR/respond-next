/**
 * The legacy roster report's rows: one per stint (sign in through sign out) per person, from their
 * status timeline. Kept apart from the page so the rules can be tested on plain data.
 */
import type { ParticipantStatus } from '@sync/domain';

export enum RosterStage {
  NA = 0,
  SignIn = 1,
  ArriveBase = 2,
  DepartBase = 3,
  SignOut = 4,
}

export type RosterStamps = Record<Exclude<RosterStage, RosterStage.NA>, number>;

// The legacy mapping: standby, assigned and not responding don't appear on a roster.
const rosterStages: Record<ParticipantStatus, RosterStage> = {
  unknown: RosterStage.NA,
  notResponding: RosterStage.NA,
  standby: RosterStage.NA,
  assigned: RosterStage.NA,
  responding: RosterStage.SignIn,
  remote: RosterStage.SignIn,
  staging: RosterStage.ArriveBase,
  demobilizing: RosterStage.DepartBase,
  clear: RosterStage.SignOut,
};

export interface RosterPerson {
  id: string;
  firstname: string;
  lastname: string;
  miles: number | null | undefined;
  /** The unit they're under now, for a standby-only row. */
  unitId: string | undefined;
  /** Newest first. */
  timeline: { status: ParticipantStatus; at: number; unitId: string }[];
}

export interface RosterEntry {
  participantId: string;
  participantName: string;
  organizationName: string;
  timestamps: RosterStamps;
  miles: number | undefined;
}

export const MIN_ROSTER_ROWS = 20;

const emptyStamps = (): RosterStamps => ({ [RosterStage.SignIn]: 0, [RosterStage.ArriveBase]: 0, [RosterStage.DepartBase]: 0, [RosterStage.SignOut]: 0 });

export const emptyRosterEntry = (): RosterEntry => ({ participantId: '', participantName: '', organizationName: '', timestamps: emptyStamps(), miles: undefined });

/** Blank rows up to the legacy minimum, for writing in by hand on the printout. */
export const padRosterEntries = (entries: RosterEntry[]): RosterEntry[] =>
  entries.length >= MIN_ROSTER_ROWS ? entries : [...entries, ...Array.from({ length: MIN_ROSTER_ROWS - entries.length }, emptyRosterEntry)];

/**
 * Someone added straight to staging or an assignment starts a stint there: that time stands in for
 * the sign in (and, for staging, is also their arrival at base). Gives the stage the stint is then at.
 */
const lateStart = (status: ParticipantStatus): RosterStage | undefined =>
  status === 'staging' ? RosterStage.ArriveBase : status === 'assigned' ? RosterStage.SignIn : undefined;

/**
 * Keeps the entries that move a stint forward one stage at a time (newest first, as given), so a
 * repeated or out-of-order status doesn't overwrite a stamp. A sign out always ends the stint.
 */
function scrubTimeline(timeline: RosterPerson['timeline']): RosterPerson['timeline'] {
  const kept: RosterPerson['timeline'] = [];
  let prior = RosterStage.NA;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const t = timeline[i]!;
    const stage = rosterStages[t.status];
    const late: RosterStage | undefined = prior === RosterStage.NA ? lateStart(t.status) : undefined;
    if (late !== undefined) {
      kept.unshift(t);
      prior = late;
    } else if (stage === RosterStage.NA && i === 0) {
      kept.unshift(t); // the latest status
      prior = stage;
    } else if (stage === RosterStage.SignOut) {
      kept.unshift(t);
      prior = RosterStage.NA;
    } else if (stage === prior + 1) {
      kept.unshift(t);
      prior = stage;
    }
  }
  return kept;
}

/** The rows by name as shown (so last name first changes the order), optionally by unit first, and a person's stints oldest first. */
export function rosterEntries(
  people: RosterPerson[],
  unitName: (unitId: string) => string,
  options: { lastNameFirst: boolean; showStandby: boolean; groupByUnit?: boolean },
): RosterEntry[] {
  const entries: RosterEntry[] = [];
  for (const person of people) {
    const name = options.lastNameFirst ? `${person.lastname}, ${person.firstname}` : `${person.firstname} ${person.lastname}`;
    const create = (unitId: string | undefined) => {
      const entry: RosterEntry = { participantId: person.id, participantName: name, organizationName: unitId ? unitName(unitId) : '', timestamps: emptyStamps(), miles: undefined };
      entries.unshift(entry);
      return entry;
    };
    const timeline = scrubTimeline(person.timeline);
    for (let i = timeline.length - 1; i >= 0; i--) {
      const t = timeline[i]!;
      const stage = rosterStages[t.status];
      let entry = entries.find((e) => e.participantId === person.id && !e.timestamps[RosterStage.SignOut]);
      if (!entry) {
        const late = lateStart(t.status);
        if (late === undefined && stage !== RosterStage.SignIn) continue; // a stint starts with a sign in
        entry = create(t.unitId);
        entry.timestamps[RosterStage.SignIn] = t.at;
      }
      if (stage !== RosterStage.NA) entry.timestamps[stage] = t.at;
    }
    // Miles are kept per person, not per stint, so they go on the person's first row.
    const first = [...entries].reverse().find((e) => e.participantId === person.id);
    if (first) first.miles = person.miles ?? 0;
    if (options.showStandby && !first) create(person.unitId);
  }
  const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  return entries.sort(
    (a, b) =>
      (options.groupByUnit ? byText(a.organizationName, b.organizationName) : 0) || //
      byText(a.participantName, b.participantName) ||
      a.timestamps[RosterStage.SignIn] - b.timestamps[RosterStage.SignIn],
  );
}

const CSV_HEADER = '"participant_id","participant_name","organization_name","sign_in","arrive_base","depart_base","sign_out","miles"';

/** The legacy roster.csv. */
export function rosterCsv(entries: RosterEntry[], formatTime: (time: number) => string): string {
  const lines = entries.map((e) =>
    [e.participantId, e.participantName, e.organizationName, ...Object.values(e.timestamps).map((t) => (t ? formatTime(t) : '')), e.miles ?? '']
      .map(String)
      .map((v) => `"${v.replaceAll('"', '""')}"`)
      .join(','),
  );
  return [CSV_HEADER, ...lines].join('\r\n');
}
