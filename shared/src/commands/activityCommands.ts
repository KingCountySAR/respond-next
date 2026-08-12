import { createAction } from '@reduxjs/toolkit';

import { Activity, OrganizationStatus } from '../types/activity';

// Activity summary + lifecycle intents (edit details, remove, complete/reactivate,
// add a participating org). Client -> server.

const UpdateActivity = createAction('cmd/activity/update', (updates: Partial<Activity> & { id: string }) => ({
  payload: { updates },
}));

const RemoveActivity = createAction('cmd/activity/remove', (activityId: string) => ({
  payload: { activityId },
}));

const CompleteActivity = createAction('cmd/activity/complete', (activityId: string, endTime: number) => ({
  payload: { activityId, endTime },
}));

const ReactivateActivity = createAction('cmd/activity/reactivate', (activityId: string) => ({
  payload: { activityId },
}));

const AppendOrganizationTimeline = createAction('cmd/activity/appendOrg', (activityId: string, org: { id: string; title: string; rosterName?: string }, status: { time: number; status: OrganizationStatus }) => ({
  payload: { activityId, orgId: org.id, org, status },
}));

// Intent to add the operations properties (teams/comms/staff/places + default
// places) to an activity that is missing them. The server builds the default
// state so every client receives identical place ids.
const DecorateOperations = createAction('cmd/activity/decorateOps', (activityId: string) => ({
  payload: { activityId },
}));

export const ActivityCommands = {
  UpdateActivity,
  RemoveActivity,
  CompleteActivity,
  ReactivateActivity,
  AppendOrganizationTimeline,
  DecorateOperations,
};
