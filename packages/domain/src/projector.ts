/**
 * What each view may see: the security boundary. Views are keyed by tier and class, so a change is
 * projected once per key however many people are connected. Command and support see everything.
 *
 * The field lists below also define the field record types (`FieldParticipantRec`, ...), so the UI's
 * types can't drift from what the server actually sends.
 */
import type { Projector, Rec, Viewer } from '@sync/core';
import type { ActivityRec, ActivityUnitRec, AssignmentRec, ContactRec, EquipmentRec, GroupRec, ParticipantRec, PlaceRec, Target, TeamRec, TeamStatusRec } from './schema';
import { asActivityViewer, isCommand } from './viewer';

export type ViewKey = 'command' | 'field:member' | 'field:external';

/** A record type's declared fields, without the `[field: string]: unknown` index signature. */
type KnownKeys<T> = keyof { [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K] };
const fields = <R>() => <const F extends readonly KnownKeys<R>[]>(f: F): F => f;

// Everything the legacy briefing showed every responder: the description and map included.
const ACTIVITY_FIELDS = fields<ActivityRec>()(['idNumber', 'kind', 'title', 'description', 'location', 'mapId', 'startTime', 'endTime', 'earlySignInWindow', 'ownerOrgId', 'mode', 'standbyOnly', 'closed', 'removedAt']);
const MEMBER_PARTICIPANT_FIELDS = fields<ParticipantRec>()(['personRef', 'firstname', 'lastname', 'memberTags', 'activityTags', 'eta', 'miles']);
const EXTERNAL_PARTICIPANT_FIELDS = fields<ParticipantRec>()(['firstname', 'lastname', 'memberTags', 'activityTags', 'miles']);
const ASSIGNMENT_FIELDS = fields<AssignmentRec>()(['participantId', 'at', 'by']);
const TEAM_FIELDS = fields<TeamRec>()(['name']);
const MEMBER_GROUP_FIELDS = fields<GroupRec>()(['name', 'leaderParticipantId']);
const EXTERNAL_GROUP_FIELDS = fields<GroupRec>()(['name']);
const PLACE_FIELDS = fields<PlaceRec>()(['name']);

// --- Field record types -----------------------------------------------------------------------

type BaseKeys = 'type' | 'id' | 'version' | 'deleted';
type Visible<R, F extends readonly unknown[]> = Pick<R, Extract<BaseKeys | F[number], keyof R>>;
/** Fields every field viewer gets, plus the ones only members get (absent for external people). */
type FieldView<R, Member extends readonly unknown[], External extends readonly unknown[]> = Visible<R, External> &
  Partial<Pick<R, Extract<Exclude<Member[number], External[number]>, keyof R>>>;

export type FieldActivityRec = Visible<ActivityRec, typeof ACTIVITY_FIELDS>;
export type FieldParticipantRec = FieldView<ParticipantRec, typeof MEMBER_PARTICIPANT_FIELDS, typeof EXTERNAL_PARTICIPANT_FIELDS>;
/** Members only; external people get no assignments. The target says only which kind of place. */
export type FieldAssignmentRec = Visible<AssignmentRec, typeof ASSIGNMENT_FIELDS> & { target: Pick<Target, 'kind'> | null };
export type FieldTeamRec = Visible<TeamRec, typeof TEAM_FIELDS>;
/** Members only. */
export type FieldTeamStatusRec = TeamStatusRec;
export type FieldGroupRec = FieldView<GroupRec, typeof MEMBER_GROUP_FIELDS, typeof EXTERNAL_GROUP_FIELDS>;
export type FieldPlaceRec = Visible<PlaceRec, typeof PLACE_FIELDS>;
/** Every field viewer sees units (and their statuses) and equipment in full. */
export type FieldUnitRec = ActivityUnitRec;
export type FieldEquipmentRec = EquipmentRec;
/** Members only. */
export type FieldContactRec = ContactRec;

// --- Rules ------------------------------------------------------------------------------------

const pick = (rec: Rec, keep: readonly string[]): Rec => {
  const out: Rec = { type: rec.type, id: rec.id, version: rec.version };
  if (rec.deleted) out.deleted = true;
  for (const f of keep) if (f in rec) out[f] = rec[f];
  return out;
};

type Rule = (rec: Rec) => Rec | null;
const all: Rule = (rec) => rec;
const none: Rule = () => null;
const only =
  (keep: readonly string[]): Rule =>
  (rec) =>
    pick(rec, keep);

/** Field members see which kind of place someone is at, but not which team or place. */
const assignmentKindOnly: Rule = (rec) => {
  const target = rec.target as { kind: string } | null;
  return { ...pick(rec, ASSIGNMENT_FIELDS), target: target ? { kind: target.kind } : null };
};

const FIELD_RULES: Record<'member' | 'external', Record<string, Rule>> = {
  member: {
    activity: only(ACTIVITY_FIELDS),
    activityUnit: all,
    unitStatus: all,
    participant: only(MEMBER_PARTICIPANT_FIELDS),
    participantStatus: all,
    assignment: assignmentKindOnly,
    contact: all,
    team: only(TEAM_FIELDS),
    teamStatus: all,
    group: only(MEMBER_GROUP_FIELDS),
    place: only(PLACE_FIELDS),
    equipment: all,
    comm: none,
    // Lists are for everyone; a summary holds no person refs.
    activitySummary: all,
  },
  external: {
    activity: only(ACTIVITY_FIELDS),
    activityUnit: all,
    unitStatus: all,
    participant: only(EXTERNAL_PARTICIPANT_FIELDS),
    participantStatus: all,
    assignment: none,
    contact: none,
    team: only(TEAM_FIELDS),
    teamStatus: none,
    group: only(EXTERNAL_GROUP_FIELDS),
    place: only(PLACE_FIELDS),
    equipment: all,
    comm: none,
    // Lists are for everyone; a summary holds no person refs.
    activitySummary: all,
  },
};

export const activityProjector: Projector = {
  viewKey(viewer: Viewer): ViewKey {
    if (isCommand(viewer)) return 'command';
    return asActivityViewer(viewer).class === 'member' ? 'field:member' : 'field:external';
  },
  project(viewKey, rec) {
    if (viewKey === 'command') return rec;
    const rules = FIELD_RULES[viewKey === 'field:member' ? 'member' : 'external'];
    // Unknown record types are hidden: a new type is invisible to field views until a rule says otherwise.
    return (rules[rec.type] ?? none)(rec);
  },
};
