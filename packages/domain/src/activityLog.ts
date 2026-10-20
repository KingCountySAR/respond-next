/**
 * The activity log: a readable line for each change made to an activity ("Dana Field moved from
 * Standby to Responding"), shown in the ops dashboard's comms log beside the comms entries. The
 * server writes the lines after each commit, from the change and the records it touched, into a
 * scope of their own beside the activity (`activityLogId`), so the activity stays small and only the
 * dashboard syncs them. Command only, like comms.
 *
 * Team status and GAR changes are level 3, the legacy app's automated comms; every other change is
 * level 4. Starring a line raises it above level 1, as for a comms entry.
 */
import { z } from 'zod';
import { Rejection, defineMutation, type ReadView, type Rec } from '@sync/core';
import { GAR_TEXT, PARTICIPANT_STATUS_TEXT, TEAM_STATUS_TEXT, UNIT_STATUS_TEXT } from './labels';
import { compareEntries, findParticipantByPersonRef, fullName, participantName, targetName } from './queries';
import { ACTIVITY_RECORD_ID, type ActivityUnitRec, type GroupRec, type AssignmentRec, type LogLevel, type ParticipantRec, type ParticipantStatusRec, type TeamRec, type TeamStatusRec, type UnitStatusRec } from './schema';
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
}

export type LogLine = Omit<LogEntryRec, 'type' | 'id' | 'version' | 'favorite'>;

const Line = z.object({ id: z.string().min(1), at: z.number().finite(), by: z.string(), text: z.string().min(1), level: z.union([z.literal(3), z.literal(4)]), mutation: z.string() });

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
  const line = (text: string, level: LogLevel = 4, when = at) => lines.push({ at: when, by, text, level, mutation: change.name });
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
    // Their own change, or the server's on their behalf (signing in elsewhere signs them out here).
    const self = !!p && (p.personRef === actor.personRef || system);
    if (prev) line(self ? `${subject} moved from ${PARTICIPANT_STATUS_TEXT[prev.status]} to ${to}` : `${by} moved ${subject} from ${PARTICIPANT_STATUS_TEXT[prev.status]} to ${to}`, 4, s.at);
    else line(self ? `${subject} joined as ${to}` : `${by} added ${subject} as ${to}`, 4, s.at);
  }
  for (const s of added<TeamStatusRec>('teamStatus')) {
    const prev = previous(view.scan<TeamStatusRec>('teamStatus'), s, (e) => e.teamId === s.teamId);
    const team = named('team', s.teamId);
    // A team is In Base until its first status.
    line(`${by} set ${team} from ${TEAM_STATUS_TEXT[prev?.status ?? 'inBase']} to ${TEAM_STATUS_TEXT[s.status]}`, 3, s.at);
  }
  for (const { before, after } of changed<TeamRec>('team')) {
    if (before.gar !== after.gar) line(`${by} set ${after.name}'s GAR from ${GAR_TEXT[before.gar]} to ${GAR_TEXT[after.gar]}`, 3);
  }
  for (const s of added<UnitStatusRec>('unitStatus')) {
    const unit = view.get<ActivityUnitRec>('activityUnit', s.unitId);
    line(`${by} set ${unit?.rosterName ?? unit?.title ?? 'a unit'} to ${UNIT_STATUS_TEXT[s.status]}`, 4, s.at);
  }

  const a = (change.args ?? {}) as Args;
  const sentence = SENTENCES[change.name]?.({ a, view, by, named, person, changed, added });
  if (sentence) line(sentence.text, sentence.level);
  return lines;
}

interface SentenceContext {
  a: Args;
  view: ReadView;
  by: string;
  named(type: string, id: unknown): string;
  person(id: unknown): string;
  changed<T extends Rec>(type: string): { before: T; after: T }[];
  added<T extends Rec>(type: string): T[];
}

type Sentence = (c: SentenceContext) => { text: string; level: LogLevel } | null;
const s4 = (text: string) => ({ text, level: 4 as const });

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

/** One sentence per change, besides the timeline lines above; null when those say it all. */
const SENTENCES: Record<string, Sentence> = {
  createActivity: ({ a, by }) => s4(`${by} created ${str(a.title)}`),
  updateActivity: ({ by, changed }) => {
    const fields = editedFields(changed('activity'));
    return fields.length ? s4(`${by} edited the activity${fieldList(fields)}`) : null;
  },
  closeActivity: ({ by }) => ({ text: `${by} closed the activity`, level: 3 }),
  reopenActivity: ({ by }) => ({ text: `${by} reopened the activity`, level: 3 }),
  removeActivity: ({ by }) => s4(`${by} removed the activity`),
  assign: ({ a, by, person, view }) => s4(a.target ? `${by} assigned ${person(a.participantId)} to ${targetName(view, a.target as never)}` : `${by} unassigned ${person(a.participantId)}`),
  createTeam: ({ a, by }) => s4(`${by} created ${str(a.name)}`),
  updateTeam: ({ by, changed }) => {
    const pairs = changed<TeamRec>('team');
    const fields = editedFields(pairs, ['gar']); // a GAR change has its own line
    return fields.length ? s4(`${by} edited ${pairs[0]!.after.name}${fieldList(fields)}`) : null;
  },
  setTeamLeader: ({ a, by, named, person }) => s4(a.participantId ? `${by} made ${person(a.participantId)} leader of ${named('team', a.teamId)}` : `${by} cleared the leader of ${named('team', a.teamId)}`),
  // Disbanding adds a team status, which has its own line.
  deleteTeam: ({ a, by, named }) => s4(`${by} deleted ${named('team', a.teamId)}`),
  createGroup: ({ a, by }) => s4(`${by} created group ${str(a.name)}`),
  updateGroup: ({ a, by, changed }) => {
    const pair = changed<GroupRec>('group')[0];
    return pair && pair.before.name !== pair.after.name ? s4(`${by} renamed ${pair.before.name} to ${str(a.name)}`) : null;
  },
  setGroupLeader: ({ a, by, named, person }) => s4(a.participantId ? `${by} made ${person(a.participantId)} leader of ${named('group', a.groupId)}` : `${by} cleared the leader of ${named('group', a.groupId)}`),
  deleteGroup: ({ a, by, named }) => s4(`${by} deleted ${named('group', a.groupId)}`),
  setTeamGroup: ({ a, by, named }) => s4(a.groupId ? `${by} moved ${named('team', a.teamId)} to ${named('group', a.groupId)}` : `${by} took ${named('team', a.teamId)} out of its group`),
  createPlace: ({ a, by }) => s4(`${by} created place ${str(a.name)}`),
  updatePlace: ({ a, by, named }) => s4(`${by} edited ${named('place', a.id)}`),
  deletePlace: ({ a, by, named }) => s4(`${by} deleted ${named('place', a.placeId)}`),
  createEquipment: ({ a, by, named }) => s4(`${by} added ${named('equipment', a.id)}`),
  assignEquipment: ({ a, by, named, view }) => s4(`${by} moved ${named('equipment', a.equipmentId)} to ${targetName(view, (a.target ?? null) as never)}`),
  correctParticipantStatus: ({ a, by, person, view }) => s4(`${by} corrected ${person(view.get<ParticipantStatusRec>('participantStatus', str(a.entryId))?.participantId)}'s timeline`),
  setEta: ({ a, by, person }) => s4(a.eta === null ? `${by} cleared ${person(a.participantId)}'s ETA` : `${by} updated ${person(a.participantId)}'s ETA`),
  setMiles: ({ a, by, person }) => s4(a.miles === null ? `${by} cleared ${person(a.participantId)}'s miles` : `${by} set ${person(a.participantId)}'s miles to ${String(a.miles)}`),
  setActivityTags: ({ a, by, person }) => s4(`${by} changed ${person(a.participantId)}'s tags`),
  linkPerson: ({ a, by, person }) => s4(`${by} linked ${person(a.participantId)} to a member record`),
};

/** The entry before `entry` in its timeline (those `same` picks), if any. */
function previous<T extends Rec & { at: number }>(all: Iterable<T>, entry: T, same: (e: T) => boolean): T | undefined {
  const timeline = [...all].filter(same).sort(compareEntries);
  const i = timeline.findIndex((e) => e.id === entry.id);
  return i > 0 ? timeline[i - 1] : undefined;
}

