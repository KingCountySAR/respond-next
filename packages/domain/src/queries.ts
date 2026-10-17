/**
 * Derived state, as plain functions over an activity's records. The server, the client and reports
 * all use these, so "current status" or "team members" means the same thing everywhere.
 */
import { deriveId, type ReadView } from '@sync/core';
import {
  ACTIVITY_RECORD_ID,
  PARTICIPANT_STATUSES,
  type AssignmentRec,
  type EquipmentRec,
  type ActivityRec,
  type GroupRec,
  type ParticipantRec,
  type ParticipantStatus,
  type ParticipantStatusRec,
  type Target,
  type TeamRec,
  type TeamStatusRec,
  type UnitStatusRec,
} from './schema';

/** Default for activities that don't set one: self sign-in opens 4 hours before the start. */
export const DEFAULT_EARLY_SIGN_IN_WINDOW = 4 * 60 * 60 * 1000;

interface TimedEntry {
  id: string;
  version: number;
  at: number;
}

/**
 * Orders entries by `at`, then by activity version, then by id, so every client and the server pick the
 * same current entry. Version 0 (applied locally, not yet confirmed) counts as newest.
 */
export function compareEntries(a: TimedEntry, b: TimedEntry): number {
  if (a.at !== b.at) return a.at - b.at;
  const va = a.version || Infinity;
  const vb = b.version || Infinity;
  if (va !== vb) return va < vb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The latest entry, optionally as of a time (only entries with at <= asOf count). */
export function latestEntry<T extends TimedEntry>(entries: Iterable<T>, asOf?: number): T | undefined {
  let best: T | undefined;
  for (const e of entries) {
    if (asOf !== undefined && e.at > asOf) continue;
    if (!best || compareEntries(e, best) > 0) best = e;
  }
  return best;
}

function* where<T>(items: Iterable<T>, keep: (item: T) => boolean): Generator<T> {
  for (const item of items) if (keep(item)) yield item;
}

export const getActivity = (view: ReadView): ActivityRec | undefined => view.get<ActivityRec>('activity', ACTIVITY_RECORD_ID);

// --- Participants ---------------------------------------------------------------------------

/** The id a new participant gets, derived from the person so two devices adding them agree. */
export const participantIdFor = (personRef: string): string => deriveId(`participant:${personRef}`);

export function findParticipantByPersonRef(view: ReadView, personRef: string): ParticipantRec | undefined {
  for (const p of view.scan<ParticipantRec>('participant')) if (p.personRef === personRef) return p;
  return view.get<ParticipantRec>('participant', participantIdFor(personRef));
}

export const participantStatusEntries = (view: ReadView, participantId: string): Iterable<ParticipantStatusRec> =>
  where(view.scan<ParticipantStatusRec>('participantStatus'), (s) => s.participantId === participantId);

export const currentParticipantStatus = (view: ReadView, participantId: string, asOf?: number): ParticipantStatusRec | undefined =>
  latestEntry(participantStatusEntries(view, participantId), asOf);

/** Newest first, the order the legacy timeline was kept in. */
export const participantTimeline = (view: ReadView, participantId: string): ParticipantStatusRec[] =>
  [...participantStatusEntries(view, participantId)].sort((a, b) => compareEntries(b, a));

/** The participant's status, or `unknown` before their first entry. */
export const statusOf = (view: ReadView, participantId: string, asOf?: number): ParticipantStatus =>
  currentParticipantStatus(view, participantId, asOf)?.status ?? 'unknown';

/** The unit the participant is currently responding under. */
export const currentUnitOf = (view: ReadView, participantId: string): string | undefined => currentParticipantStatus(view, participantId)?.unitId;

export const fullName = (p: Pick<ParticipantRec, 'firstname' | 'lastname'>): string => `${p.firstname} ${p.lastname}`.trim();

export const participantName = (view: ReadView, participantId: string | null | undefined): string => {
  const p = participantId ? view.get<ParticipantRec>('participant', participantId) : undefined;
  return p ? fullName(p) : 'someone';
};

/** Every status except notResponding, clear and unknown. Standby counts as active. */
export const isActiveStatus = (s: ParticipantStatus): boolean => s !== 'unknown' && s !== 'notResponding' && s !== 'clear';
export const isRespondingStatus = (s: ParticipantStatus): boolean => isActiveStatus(s) && s !== 'standby';
export const isInTransitStatus = (s: ParticipantStatus): boolean => s === 'responding' || s === 'demobilizing';
export const isCheckedInStatus = (s: ParticipantStatus): boolean => s === 'staging' || s === 'assigned';

export function statusCounts(view: ReadView, unitId?: string): Record<ParticipantStatus, number> {
  const counts = Object.fromEntries(PARTICIPANT_STATUSES.map((s) => [s, 0])) as Record<ParticipantStatus, number>;
  for (const p of view.scan<ParticipantRec>('participant')) {
    const current = currentParticipantStatus(view, p.id);
    if (unitId !== undefined && current?.unitId !== unitId) continue;
    counts[current?.status ?? 'unknown']++;
  }
  return counts;
}

// --- Assignments ----------------------------------------------------------------------------

export const assignmentEntries = (view: ReadView, participantId: string): Iterable<AssignmentRec> =>
  where(view.scan<AssignmentRec>('assignment'), (a) => a.participantId === participantId);

export const currentAssignment = (view: ReadView, participantId: string, asOf?: number): AssignmentRec | undefined =>
  latestEntry(assignmentEntries(view, participantId), asOf);

/** Where the participant is now, or null when unassigned. */
export const currentTarget = (view: ReadView, participantId: string, asOf?: number): Target | null => currentAssignment(view, participantId, asOf)?.target ?? null;

export const sameTarget = (a: Target | null | undefined, b: Target | null | undefined): boolean => (a ?? null) === (b ?? null) || (!!a && !!b && a.kind === b.kind && a.id === b.id);

/** Participants whose current assignment (as of `asOf`) is the target. */
export function membersOf(view: ReadView, target: Target, asOf?: number): ParticipantRec[] {
  const latestByParticipant = new Map<string, AssignmentRec>();
  for (const a of view.scan<AssignmentRec>('assignment')) {
    if (asOf !== undefined && a.at > asOf) continue;
    const best = latestByParticipant.get(a.participantId);
    if (!best || compareEntries(a, best) > 0) latestByParticipant.set(a.participantId, a);
  }
  const members: ParticipantRec[] = [];
  for (const [participantId, a] of latestByParticipant) {
    if (!sameTarget(a.target, target)) continue;
    const p = view.get<ParticipantRec>('participant', participantId);
    if (p) members.push(p);
  }
  return members;
}

export const teamMembers = (view: ReadView, teamId: string, asOf?: number): ParticipantRec[] => membersOf(view, { kind: 'team', id: teamId }, asOf);

export const equipmentAt = (view: ReadView, target: Target): EquipmentRec[] => [...where(view.scan<EquipmentRec>('equipment'), (e) => sameTarget(e.assignedTo, target))];

/** Whether the target exists (and, for a team, isn't disbanded). */
export function targetExists(view: ReadView, target: Target): boolean {
  if (target.kind === 'team') return !!view.get<TeamRec>('team', target.id) && teamStatusOf(view, target.id) !== 'disbanded';
  return !!view.get(target.kind, target.id);
}

export function targetName(view: ReadView, target: Target | null): string {
  if (!target) return 'unassigned';
  return view.get<{ name: string } & TeamRec>(target.kind, target.id)?.name ?? `a removed ${target.kind}`;
}

// --- Teams, groups, units -------------------------------------------------------------------

export const currentTeamStatus = (view: ReadView, teamId: string, asOf?: number): TeamStatusRec | undefined =>
  latestEntry(where(view.scan<TeamStatusRec>('teamStatus'), (s) => s.teamId === teamId), asOf);

export const teamStatusOf = (view: ReadView, teamId: string, asOf?: number) => currentTeamStatus(view, teamId, asOf)?.status ?? 'inBase';

export const groupTeams = (view: ReadView, groupId: string): TeamRec[] => [...where(view.scan<TeamRec>('team'), (t) => t.groupId === groupId)];

/** The group whose leader this participant is, if any. */
export const groupLedBy = (view: ReadView, participantId: string): GroupRec | undefined => {
  for (const g of view.scan<GroupRec>('group')) if (g.leaderParticipantId === participantId) return g;
  return undefined;
};

export const currentUnitStatus = (view: ReadView, unitId: string): UnitStatusRec | undefined =>
  latestEntry(where(view.scan<UnitStatusRec>('unitStatus'), (s) => s.unitId === unitId));

// --- Activity lifecycle ------------------------------------------------------------------------

/** When self sign-in opens; -Infinity when it's open at any time. */
export function signInOpensAt(activity: Pick<ActivityRec, 'startTime' | 'earlySignInWindow'>): number {
  return activity.earlySignInWindow === null ? -Infinity : activity.startTime - activity.earlySignInWindow;
}

export const isOpenForSignIn = (activity: ActivityRec, now: number): boolean => !activity.closed && signInOpensAt(activity) <= now;
export const isStarted = (activity: ActivityRec, now: number): boolean => !activity.closed && activity.startTime <= now;

export type ActivityPhase = 'closed' | 'inProgress' | 'openForSignIn' | 'notStarted';

export function activityPhase(activity: ActivityRec, now: number): ActivityPhase {
  if (activity.closed) return 'closed';
  if (isStarted(activity, now)) return 'inProgress';
  if (isOpenForSignIn(activity, now)) return 'openForSignIn';
  return 'notStarted';
}

/** Light mode turns off operations: teams, groups, places, equipment and comms. */
export const hasOperations = (activity: ActivityRec | undefined): boolean => activity?.mode !== 'light';
