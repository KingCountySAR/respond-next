/**
 * What each view may see: the security boundary. Views are keyed by tier and class, so a change is
 * projected once per key however many people are connected. Managers see everything.
 *
 * The field lists below also define the respond views' record types (`RespondParticipantRec`, ...),
 * so the UI's types can't drift from what the server actually sends.
 */
import { HIDDEN_VIEW, type Projector, type ReadView, type Rec, type Viewer } from '@sync/core';
import { activityOfScope } from './activityLog';
import { getActivity } from './queries';
import { ACTIVITY_ARCHIVE_ID, ACTIVITY_LIST_ID, type ActivitySummary } from './summary';
import type { ActivityKind, ActivityRec, ActivityUnitRec, AssignmentRec, ContactRec, EquipmentRec, GroupRec, ParticipantRec, PlaceRec, Target, TeamRec, TeamStatusRec } from './schema';
import { asActivityViewer, canManage, type ActivityViewer } from './viewer';

export type ViewKey = 'manage' | 'respond:member' | 'respond:external';

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

// --- Respond record types -----------------------------------------------------------------------

type BaseKeys = 'type' | 'id' | 'version' | 'deleted';
type Visible<R, F extends readonly unknown[]> = Pick<R, Extract<BaseKeys | F[number], keyof R>>;
/** Fields every respond viewer gets, plus the ones only members get (absent for external people). */
type RespondView<R, Member extends readonly unknown[], External extends readonly unknown[]> = Visible<R, External> &
  Partial<Pick<R, Extract<Exclude<Member[number], External[number]>, keyof R>>>;

export type RespondActivityRec = Visible<ActivityRec, typeof ACTIVITY_FIELDS>;
export type RespondParticipantRec = RespondView<ParticipantRec, typeof MEMBER_PARTICIPANT_FIELDS, typeof EXTERNAL_PARTICIPANT_FIELDS>;
/** Members only; external people get no assignments. The target says only which kind of place. */
export type RespondAssignmentRec = Visible<AssignmentRec, typeof ASSIGNMENT_FIELDS> & { target: Pick<Target, 'kind'> | null };
export type RespondTeamRec = Visible<TeamRec, typeof TEAM_FIELDS>;
/** Members only. */
export type RespondTeamStatusRec = TeamStatusRec;
export type RespondGroupRec = RespondView<GroupRec, typeof MEMBER_GROUP_FIELDS, typeof EXTERNAL_GROUP_FIELDS>;
export type RespondPlaceRec = Visible<PlaceRec, typeof PLACE_FIELDS>;
/** Every respond viewer sees units (and their statuses) and equipment in full. */
export type RespondUnitRec = ActivityUnitRec;
export type RespondEquipmentRec = EquipmentRec;
/** Members only. */
export type RespondContactRec = ContactRec;

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

/** Respond-tier members see which kind of place someone is at, but not which team or place. */
const assignmentKindOnly: Rule = (rec) => {
  const target = rec.target as { kind: string } | null;
  return { ...pick(rec, ASSIGNMENT_FIELDS), target: target ? { kind: target.kind } : null };
};

const RESPOND_RULES: Record<'member' | 'external', Record<string, Rule>> = {
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

/**
 * Who a viewer is on an activity: the limit on who manages is for missions only, so members
 * manage trainings and other events (for now). Undefined, as they are, for missions, external
 * people, managers already, and an activity not yet known.
 */
export function viewerOnActivity(viewer: Viewer, view: ReadView): ActivityViewer | undefined {
  const v = asActivityViewer(viewer);
  if (canManage(v) || v.class !== 'member') return undefined;
  const kind = getActivity(view)?.kind;
  return kind && kind !== 'mission' ? { ...v, tier: 'manage', missionTier: v.tier } : undefined;
}

/**
 * Who a client is on an activity, from the view the server projects it for (which counts grants)
 * and its records (its kind); undefined for who they are.
 */
export function clientViewerOn(viewer: ActivityViewer, copy: { view: string | undefined; records: ReadView }): ActivityViewer | undefined {
  const byKind = viewerOnActivity(viewer, copy.records);
  if (byKind) return byKind;
  return copy.view === 'manage' && !canManage(viewer) ? { ...viewer, tier: 'manage' } : undefined;
}

export const activityProjector: Projector = {
  viewerIn: viewerOnActivity,
  viewKey(viewer: Viewer): ViewKey {
    if (canManage(viewer)) return 'manage';
    return asActivityViewer(viewer).class === 'member' ? 'respond:member' : 'respond:external';
  },
  project(viewKey, rec) {
    if (viewKey === 'manage') return rec;
    const rules = RESPOND_RULES[viewKey === 'respond:member' ? 'member' : 'external'];
    // Unknown record types are hidden: a new type is invisible to respond views until a rule says otherwise.
    return (rules[rec.type] ?? none)(rec);
  },
};

// --- Which sites see an activity -----------------------------------------------------------------

/** What decides which sites see an activity. */
export interface ActivityAudience {
  kind: ActivityKind;
  ownerOrgId: string;
  unitIds: string[];
}

/** Whether a site (an organization) sees an activity; the server's organizations decide. */
export type SeesActivity = (siteId: string, activity: ActivityAudience) => boolean;

const audienceOf = (s: Pick<ActivitySummary, 'ownerOrgId' | 'activity' | 'units'>): ActivityAudience => ({ kind: s.activity.kind, ownerOrgId: s.ownerOrgId, unitIds: s.units.map((u) => u.id) });

/**
 * The activity projector, for viewers on a site (`siteId`): an activity their site doesn't see is
 * hidden from them, and so is its summary in the list and archive. Those are projected per site
 * (`respond:member@<site>`); activities aren't, since a viewer either sees all of one or none.
 *
 * An activity's log isn't checked: it has no units to check against. It's for managers only.
 */
export function siteActivityProjector(sees: SeesActivity): Projector {
  return {
    viewerIn(viewer, view, scopeId) {
      const { siteId, ...v } = asActivityViewer(viewer);
      if (!siteId) return viewerOnActivity(viewer, view);
      if (scopeId === ACTIVITY_LIST_ID || scopeId === ACTIVITY_ARCHIVE_ID) return undefined;
      const a = getActivity(view);
      // A new activity (nothing yet) is anyone's to create.
      if (a && activityOfScope(scopeId) === scopeId && !sees(siteId, { kind: a.kind, ownerOrgId: a.ownerOrgId, unitIds: [...view.scan<ActivityUnitRec>('activityUnit')].map((u) => u.id) })) {
        return { ...v, hidden: true };
      }
      return viewerOnActivity(v, view) ?? v;
    },
    viewKey(viewer) {
      const v = asActivityViewer(viewer);
      if (v.hidden) return HIDDEN_VIEW;
      const key = activityProjector.viewKey(viewer);
      return v.siteId ? `${key}@${v.siteId}` : key;
    },
    project(viewKey, rec) {
      if (viewKey === HIDDEN_VIEW) return null;
      const [key, siteId] = viewKey.split('@') as [string, string | undefined];
      if (siteId && rec.type === 'activitySummary' && !sees(siteId, audienceOf(rec as unknown as ActivitySummary))) return null;
      return activityProjector.project(key, rec);
    },
  };
}
