import { createAction } from '@reduxjs/toolkit';

import { Activity, OrganizationStatus } from '../types/activity';
import { OperationsSpecificFields } from '../types/operations';

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

// The server has stamped the default operations state onto an activity. The
// payload carries the fully-built operations (server-minted place ids) so every
// client applies identical state.
const OperationsDecorated = createAction('evt/activity/operationsDecorated', (activityId: string, operations: OperationsSpecificFields) => ({
  payload: { activityId, operations },
}));

export const ActivityEvents = {
  ActivityUpdated,
  ActivityRemoved,
  ActivityCompleted,
  ActivityReactivated,
  OrganizationTimelineAppended,
  OperationsDecorated,
};
