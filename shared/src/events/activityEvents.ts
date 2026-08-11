import { createAction } from '@reduxjs/toolkit';

import { Activity, OrganizationStatus } from '../types/activity';

// Activity summary + lifecycle facts.

const ActivityUpdated = createAction('evt/activity/updated', (updates: Partial<Activity> & { id: string }) => ({
  payload: { updates },
}));

const ActivityRemoved = createAction('evt/activity/removed', (activityId: string) => ({
  payload: { activityId },
}));

const ActivityCompleted = createAction('evt/activity/completed', (activityId: string, endTime: number) => ({
  payload: { activityId, endTime },
}));

const ActivityReactivated = createAction('evt/activity/reactivated', (activityId: string) => ({
  payload: { activityId },
}));

const OrganizationTimelineAppended = createAction(
  'evt/activity/orgAppended',
  (activityId: string, orgId: string, org: { id: string; title: string; rosterName?: string }, status: { time: number; status: OrganizationStatus }) => ({
    payload: { activityId, orgId, org, status },
  }),
);

export const ActivityEvents = {
  ActivityUpdated,
  ActivityRemoved,
  ActivityCompleted,
  ActivityReactivated,
  OrganizationTimelineAppended,
};
