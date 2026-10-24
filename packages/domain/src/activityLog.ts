/**
 * The activity log: a readable line for each change made to an activity ("Dana Field moved from
 * Standby to Responding", or "Team 2 created", with who made it beside), shown in the ops dashboard's
 * comms log beside the comms entries. The server writes the lines after each commit, from the change
 * and the records it touched, into a scope of their own beside the activity (`activityLogId`), so the
 * activity stays small and only the dashboard syncs them. Command only, like comms.
 *
 * What the legacy app logged by itself as automated comms is Auto: team status and GAR, groups
 * formed, renamed, led and ended, places set up and ended, team leaders, and the activity closing or
 * reopening. Every other change is Audit. Starring a line makes it Important, as for a comms entry
 * (see `Level`).
 */
import { z } from 'zod';
import { Rejection, defineMutation, type ReadView, type Rec } from '@sync/core';
import { GAR_TEXT, PARTICIPANT_STATUS_TEXT, TEAM_STATUS_TEXT, UNIT_STATUS_TEXT } from './labels';
import { compareEntries, findParticipantByPersonRef, fullName, participantName, targetName } from './queries';
import { ACTIVITY_RECORD_ID, type ActivityUnitRec, type GroupRec, type AssignmentRec, Level, type LogLevel, type ParticipantRec, type ParticipantStatusRec, type TeamRec, type TeamStatusRec, type UnitStatusRec } from './schema';
import { SYSTEM_VIEWER, isCommand, isSystemViewer } from './viewer';

const PREFIX = '$log:';

/** The scope an activity's log lives in. */
export const activityLogId = (activityId: string): string => `${PREFIX}${activityId}`;

/** The activity a scope belongs to: its own id, or for a log scope, its activity's. */
export const activityOfScope = (scopeId: string): string => (scopeId.startsWith(PREFIX) ? scopeId.slice(PREFIX.length) : scopeId);

/** Scopes the server keeps (the list, archive and logs), not activities: their ids start with `$`. */
export const isReservedScope = (scopeId: string): boolean => scopeId.startsWith('$');

export interface LogEntryRec extends Rec {
  type: 'logEntry';
  /** When it happened: the change's own time, or when the server got it. */
  at: number;
  /** Who made the change. */
  by: string;
  text: string;
  level: LogLevel;
  favorite: boolean;
  /** The mutation that made it. */
  mutation: string;
  /** Show `by` beside the text, which never names who made the change; absent on someone's own status. */
  byline?: boolean;
}

export type LogLine = Omit<LogEntryRec, 'type' | 'id' | 'version' | 'favorite'>;

/** A log line's level: Important starred, else the level it was written at. */
export const logEntryLevel = (e: Pick<LogEntryRec, 'favorite' | 'level'>): Level => (e.favorite ? Level.Important : e.level);

const Line = z.object({ id: z.string().min(1), at: z.number().finite(), by: z.string(), text: z.string().min(1), level: z.union([z.literal(Level.Auto), z.literal(Level.Audit)]), mutation: z.string(), byline: z.boolean().optional() });

/**
 * Adds lines to a log scope (an id already there is left alone, favorite and all), and keeps its copy
 * of the activity record, which says who is who there (members are command on events). The server's own.
 */
export const appendLog = defineMutation({
  name: 'appendLog',
  version: 1,
  args: z.object({ lines: z.array(Line), activity: z.record(z.string(), z.unknown()).optional() }),
  allow: isSystemViewer,
  describe: (a) => `Log ${a.lines.length} changes`,
  run(tx, a) {
    if (a.activity) tx.put({ ...a.activity, type: 'activity', id: ACTIVITY_RECORD_ID });
    for (const line of a.lines) if (!tx.get('logEntry', line.id)) tx.put({ type: 'logEntry', ...line, favorite: false });
  },
});

export const setLogFavorite = defineMutation({
  name: 'setLogFavorite',
  version: 1,
  args: z.object({ id: z.string().min(1), favorite: z.boolean() }),
  allow: isCommand,
  describe: (a) => (a.favorite ? 'Star a log line' : 'Unstar a log line'),
  run(tx, a) {
    if (!tx.get('logEntry', a.id)) throw new Rejection('not_found', 'That log line no longer exists');
    tx.update('logEntry', a.id, { favorite: a.favorite });
  },
});

/** A change as the server committed it, with who made it. */
export interface LoggedChange {
  name: string;
  args: unknown;
  /** The change's own time, for timed changes. */
  at?: number;
  receivedAt: number;
  effects: { type: string; id: string; before?: Rec; after?: Rec }[];
  actor: { userId: string; name?: string; personRef?: string };
}

/** Changes that get no line: comms are in the log already, and the server's own bookkeeping. */
const UNLOGGED = new Set(['addComm', 'editComm', 'deleteComm', 'setMemberInfo', 'setActivitySummary', 'appendLog', 'setLogFavorite']);

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * The lines a change makes, from the change and the records it touched; `view` is the activity as it
 * is now, for names. Timelines (statuses) are read from the entries the change added, whatever
 * change added them; the rest is one sentence per change.
 */
export function narrate(change: LoggedChange, view: ReadView): LogLine[] {
  if (UNLOGGED.has(change.name)) return [];
  const { actor } = change;
  const actorParticipant = actor.personRef ? findParticipantByPersonRef(view, actor.personRef) : undefined;
  const system = actor.userId === SYSTEM_VIEWER.userId;
  const by = actor.name || (actorParticipant ? fullName(actorParticipant) : system ? 'The server' : 'Someone');
  const at = change.at ?? change.receivedAt;
  const lines: LogLine[] = [];
  const line = (text: string, level: LogLevel = Level.Audit, when = at, byline = true) => lines.push({ at: when, by, text, level, mutation: change.name, ...(byline ? { byline } : {}) });
  const added = <T extends Rec>(type: string) => change.effects.filter((e) => e.type === type && !e.before && e.after).map((e) => e.after as T);
  const changed = <T extends Rec>(type: string) => change.effects.filter((e) => e.type === type && e.before && e.after) as unknown as { before: T; after: T }[];
  const removed = <T extends Rec>(type: string) => change.effects.filter((e) => e.type === type && e.before && !e.after).map((e) => e.before as T);
  const named = (type: string, id: unknown) => view.get<{ name: string } & Rec>(type, str(id))?.name ?? removed<{ name: string } & Rec>(type).find((r) => r.id === id)?.name ?? `a removed ${type}`;
  const person = (id: unknown) => participantName(view, str(id));

  for (const s of added<ParticipantStatusRec>('participantStatus')) {
    const p = view.get<ParticipantRec>('participant', s.participantId);
    const subject = p ? fullName(p) : 'Someone';
    const prev = previous(view.scan<ParticipantStatusRec>('participantStatus'), s, (e) => e.participantId === s.participantId);
    const to = PARTICIPANT_STATUS_TEXT[s.status];
    // Told as theirs. Someone else's change says who made it beside the text; the server's on their
    // behalf (signing in elsewhere signs them out here) doesn't.
    const self = !!p && (p.personRef === actor.personRef || system);
    line(prev ? `${subject} is ${to} (was ${PARTICIPANT_STATUS_TEXT[prev.status]})` : `${subject} signed in as ${to}`, Level.Audit, s.at, !self);
  }
  for (const s of added<TeamStatusRec>('teamStatus')) {
    const prev = previous(view.scan<TeamStatusRec>('teamStatus'), s, (e) => e.teamId === s.teamId);
    const team = named('team', s.teamId);
    // A team is In Base until its first status.
    line(`${team} is ${TEAM_STATUS_TEXT[s.status]} (was ${TEAM_STATUS_TEXT[prev?.status ?? 'inBase']})`, Level.Auto, s.at);
  }
  for (const { before, after } of changed<TeamRec>('team')) {
    if (before.gar !== after.gar) line(`${after.name}'s GAR is ${GAR_TEXT[after.gar]} (was ${GAR_TEXT[before.gar]})`, Level.Auto);
  }
  for (const s of added<UnitStatusRec>('unitStatus')) {
    const unit = view.get<ActivityUnitRec>('activityUnit', s.unitId);
    line(`${unit?.rosterName ?? unit?.title ?? 'A unit'} moved to ${UNIT_STATUS_TEXT[s.status]}`, Level.Audit, s.at);
  }

  const a = (change.args ?? {}) as Args;
  const sentence = SENTENCES[change.name]?.({ a, view, named, person, changed, added });
  if (sentence) line(sentence.text, sentence.level);
  return lines;
}

interface SentenceContext {
  a: Args;
  view: ReadView;
  named(type: string, id: unknown): string;
  person(id: unknown): string;
  changed<T extends Rec>(type: string): { before: T; after: T }[];
  added<T extends Rec>(type: string): T[];
}

type Sentence = (c: SentenceContext) => { text: string; level: LogLevel } | null;
const audit = (text: string) => ({ text, level: Level.Audit });
const auto = (text: string) => ({ text, level: Level.Auto });

/** Fields of a record a change edited, by name, for "edited Team 2 (notes)". */
function editedFields(pairs: { before: Rec; after: Rec }[], ignore: string[] = []): string[] {
  const out = new Set<string>();
  for (const { before, after } of pairs) {
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (k === 'version' || ignore.includes(k)) continue;
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out.add(k);
    }
  }
  return [...out];
}

const fieldList = (fields: string[]) => (fields.length ? ` (${fields.join(', ')})` : '');

/**
 * One sentence per change, besides the timeline lines above: what it's about first, for scanning, and
 * who made it left to the byline. Null when those say it all.
 */
const SENTENCES: Record<string, Sentence> = {
  createActivity: ({ a }) => audit(`${str(a.title)} created`),
  updateActivity: ({ changed }) => {
    const fields = editedFields(changed('activity'));
    return fields.length ? audit(`Activity edited${fieldList(fields)}`) : null;
  },
  closeActivity: () => auto('Activity closed'),
  reopenActivity: () => auto('Activity reopened'),
  removeActivity: () => audit('Activity removed'),
  assign: ({ a, person, view }) => audit(a.target ? `${person(a.participantId)} assigned to ${targetName(view, a.target as never)}` : `${person(a.participantId)} unassigned`),
  createTeam: ({ a }) => audit(`${str(a.name)} created`),
  updateTeam: ({ changed }) => {
    const pairs = changed<TeamRec>('team');
    const fields = editedFields(pairs, ['gar']); // a GAR change has its own line
    return fields.length ? audit(`${pairs[0]!.after.name} edited${fieldList(fields)}`) : null;
  },
  setTeamLeader: ({ a, named, person }) => auto(a.participantId ? `${named('team', a.teamId)} leader set to ${person(a.participantId)}` : `${named('team', a.teamId)} leader cleared`),
  // Disbanding adds a team status, which has its own line.
  deleteTeam: ({ a, named }) => audit(`${named('team', a.teamId)} deleted`),
  createGroup: ({ a }) => auto(`Group ${str(a.name)} created`),
  updateGroup: ({ a, changed }) => {
    const pair = changed<GroupRec>('group')[0];
    return pair && pair.before.name !== pair.after.name ? auto(`${pair.before.name} renamed to ${str(a.name)}`) : null;
  },
  setGroupLeader: ({ a, named, person }) => auto(a.participantId ? `${named('group', a.groupId)} leader set to ${person(a.participantId)}` : `${named('group', a.groupId)} leader cleared`),
  deleteGroup: ({ a, named }) => auto(`${named('group', a.groupId)} deleted`),
  setTeamGroup: ({ a, named }) => audit(a.groupId ? `${named('team', a.teamId)} moved to ${named('group', a.groupId)}` : `${named('team', a.teamId)} taken out of its group`),
  createPlace: ({ a }) => auto(`Place ${str(a.name)} created`),
  updatePlace: ({ a, named }) => audit(`${named('place', a.id)} edited`),
  deletePlace: ({ a, named }) => auto(`${named('place', a.placeId)} deleted`),
  // Dropped from the catalog straight onto a team or place: one change, one line.
  createEquipment: ({ a, named, view }) => audit(`${named('equipment', a.id)} added${a.assignedTo ? ` to ${targetName(view, a.assignedTo as never)}` : ''}`),
  assignEquipment: ({ a, named, view }) => audit(`${named('equipment', a.equipmentId)} moved to ${targetName(view, (a.target ?? null) as never)}`),
  correctParticipantStatus: ({ a, person, view }) => audit(`${person(view.get<ParticipantStatusRec>('participantStatus', str(a.entryId))?.participantId)}'s timeline corrected`),
  setEta: ({ a, person }) => audit(a.eta === null ? `${person(a.participantId)}'s ETA cleared` : `${person(a.participantId)}'s ETA updated`),
  setMiles: ({ a, person }) => audit(a.miles === null ? `${person(a.participantId)}'s miles cleared` : `${person(a.participantId)}'s miles set to ${String(a.miles)}`),
  setActivityTags: ({ a, person }) => audit(`${person(a.participantId)}'s tags changed`),
  linkPerson: ({ a, person }) => audit(`${person(a.participantId)} linked to a member record`),
};

/** The entry before `entry` in its timeline (those `same` picks), if any. */
function previous<T extends Rec & { at: number }>(all: Iterable<T>, entry: T, same: (e: T) => boolean): T | undefined {
  const timeline = [...all].filter(same).sort(compareEntries);
  const i = timeline.findIndex((e) => e.id === entry.id);
  return i > 0 ? timeline[i - 1] : undefined;
}

