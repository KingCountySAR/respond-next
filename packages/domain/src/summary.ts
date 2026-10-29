/**
 * Activity summaries: what lists show about an activity without opening it. The server keeps one
 * per open or recent activity in the list scope (`ACTIVITY_LIST_ID`), so clients open the list like
 * an activity and it stays live, versioned and cached offline. Every activity's is also in the
 * archive scope (`ACTIVITY_ARCHIVE_ID`), which clients read over HTTP (`GET /api/activities`).
 */
import { z } from 'zod';
import { defineMutation, type ReadView, type Rec } from '@sync/core';
import { currentParticipantStatus, currentUnitStatus, getActivity, isActiveStatus } from './queries';
import type { ActivityRec, ActivityUnitRec, ParticipantRec, ParticipantStatus, UnitStatus } from './schema';
import { isSystemViewer } from './viewer';

/** The scope the summaries live in. Reserved: no activity has this id. */
export const ACTIVITY_LIST_ID = '$activities';

/** Every activity's summary, for reports. Reserved like the list; only the server reads it. */
export const ACTIVITY_ARCHIVE_ID = '$archive';

/** How long a closed activity stays in the list after it ends. */
export const ACTIVITY_LIST_HISTORY_DAYS = 14;

/**
 * Whether an activity is in the list (as the legacy app's initial state): not closed, starting in the
 * future, or ended in the last `ACTIVITY_LIST_HISTORY_DAYS` days.
 */
export function inActivityList(a: Pick<ActivityRec, 'closed' | 'startTime' | 'endTime'>, now: number): boolean {
  if (!a.closed || a.startTime > now) return true;
  return Math.max(a.startTime, a.endTime ?? 0) >= now - ACTIVITY_LIST_HISTORY_DAYS * 24 * 60 * 60 * 1000;
}

/** `GET /api/activities`: every activity's summary, from the archive. */
export interface ActivitiesResponse {
  data: ActivitySummary[];
}

/** `GET /api/activities/:id`: the activity as the viewer sees it, once (what a subscription starts with). */
export interface ActivityResponse {
  activityId: string;
  version: number;
  /** The view the records are projected for. */
  view: string;
  records: Rec[];
}

/** What a summary says; stored as an ActivitySummaryRec in the list scope. */
export interface ActivitySummary {
  type: 'activitySummary';
  /** The activity's id. */
  id: string;
  /** The unit responsible for it, which with its kind and units decides which sites see it. */
  ownerOrgId: string;
  activity: Pick<ActivityRec, 'idNumber' | 'kind' | 'title' | 'location' | 'mapId' | 'startTime' | 'endTime' | 'earlySignInWindow' | 'mode' | 'standbyOnly' | 'closed'>;
  units: { id: string; title: string; rosterName: string | null; status: UnitStatus; activeCount: number }[];
  /**
   * Everyone with a status, keyed by participant id. The id is a one-way hash of the person ref,
   * so a viewer can find their own entry (`participantIdFor`) without anyone's ref being shown.
   */
  people: Record<string, { status: ParticipantStatus; unitId: string }>;
}

export interface ActivitySummaryRec extends Rec, ActivitySummary {
  type: 'activitySummary';
  id: string;
}

/** The summary of an activity, or null once it's gone or removed (it then drops out of lists). */
export function activitySummary(view: ReadView, activityId: string): ActivitySummary | null {
  const a = getActivity(view);
  if (!a || a.removedAt !== null) return null;
  const people: ActivitySummary['people'] = {};
  const activeByUnit = new Map<string, number>();
  for (const p of view.scan<ParticipantRec>('participant')) {
    const s = currentParticipantStatus(view, p.id);
    if (!s || s.status === 'notResponding') continue;
    people[p.id] = { status: s.status, unitId: s.unitId };
    if (isActiveStatus(s.status)) activeByUnit.set(s.unitId, (activeByUnit.get(s.unitId) ?? 0) + 1);
  }
  const units = [...view.scan<ActivityUnitRec>('activityUnit')]
    .map((u) => ({ id: u.id, title: u.title, rosterName: u.rosterName, status: currentUnitStatus(view, u.id)?.status ?? 'unknown', activeCount: activeByUnit.get(u.id) ?? 0 }))
    .sort((x, y) => (x.rosterName ?? x.title).localeCompare(y.rosterName ?? y.title));
  return {
    type: 'activitySummary',
    id: activityId,
    ownerOrgId: a.ownerOrgId,
    activity: {
      idNumber: a.idNumber,
      kind: a.kind,
      title: a.title,
      location: a.location,
      mapId: a.mapId,
      startTime: a.startTime,
      endTime: a.endTime,
      earlySignInWindow: a.earlySignInWindow,
      mode: a.mode,
      standbyOnly: a.standbyOnly,
      closed: a.closed,
    },
    units,
    people,
  };
}

/** Writes (or, with null, removes) one activity's summary in the list scope. The server's own change. */
export const setActivitySummary = defineMutation({
  name: 'setActivitySummary',
  version: 1,
  args: z.object({ id: z.string().min(1), summary: z.record(z.string(), z.unknown()).nullable() }),
  allow: isSystemViewer,
  describe: (a) => (a.summary ? `Update the summary of ${a.id}` : `Remove the summary of ${a.id}`),
  run(tx, a) {
    if (a.summary) tx.put({ ...a.summary, type: 'activitySummary', id: a.id });
    else if (tx.get('activitySummary', a.id)) tx.delete('activitySummary', a.id);
  },
});
