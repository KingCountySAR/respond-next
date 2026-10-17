/**
 * What each view may see: the security boundary. Views are keyed by tier and class, so a change is
 * projected once per key however many people are connected. Command and support see everything.
 */
import type { Projector, Rec, Viewer } from '@sync/core';
import { asMissionViewer, isCommand } from './viewer';

export type ViewKey = 'command' | 'field:member' | 'field:external';

const pick = (rec: Rec, fields: readonly string[]): Rec => {
  const out: Rec = { type: rec.type, id: rec.id, version: rec.version };
  if (rec.deleted) out.deleted = true;
  for (const f of fields) if (f in rec) out[f] = rec[f];
  return out;
};

const EVENT_FIELDS = ['idNumber', 'kind', 'title', 'location', 'startTime', 'endTime', 'earlySignInWindow', 'mode', 'standbyOnly', 'closed', 'removedAt'] as const;
const NAME_ONLY = ['name'] as const;

type Rule = (rec: Rec) => Rec | null;
const all: Rule = (rec) => rec;
const none: Rule = () => null;
const only =
  (fields: readonly string[]): Rule =>
  (rec) =>
    pick(rec, fields);

/** Field members see which kind of place someone is at, but not which team or place. */
const assignmentKindOnly: Rule = (rec) => {
  const target = rec.target as { kind: string } | null;
  return { ...pick(rec, ['participantId', 'at', 'by']), target: target ? { kind: target.kind } : null };
};

const FIELD_RULES: Record<'member' | 'external', Record<string, Rule>> = {
  member: {
    event: only(EVENT_FIELDS),
    eventUnit: all,
    unitStatus: all,
    participant: only(['personRef', 'firstname', 'lastname', 'memberTags', 'missionTags', 'eta']),
    participantStatus: all,
    assignment: assignmentKindOnly,
    contact: all,
    team: only(NAME_ONLY),
    teamStatus: all,
    group: only(['name', 'leaderParticipantId']),
    place: only(NAME_ONLY),
    equipment: all,
    comm: none,
  },
  external: {
    event: only(EVENT_FIELDS),
    eventUnit: all,
    unitStatus: all,
    participant: only(['firstname', 'lastname', 'memberTags', 'missionTags']),
    participantStatus: all,
    assignment: none,
    contact: none,
    team: only(NAME_ONLY),
    teamStatus: none,
    group: only(NAME_ONLY),
    place: only(NAME_ONLY),
    equipment: all,
    comm: none,
  },
};

export const missionProjector: Projector = {
  viewKey(viewer: Viewer): ViewKey {
    if (isCommand(viewer)) return 'command';
    return asMissionViewer(viewer).class === 'member' ? 'field:member' : 'field:external';
  },
  project(viewKey, rec) {
    if (viewKey === 'command') return rec;
    const rules = FIELD_RULES[viewKey === 'field:member' ? 'member' : 'external'];
    // Unknown record types are hidden: a new type is invisible to field views until a rule says otherwise.
    return (rules[rec.type] ?? none)(rec);
  },
};
