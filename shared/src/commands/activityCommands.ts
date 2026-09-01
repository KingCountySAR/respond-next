import { createAction } from '@reduxjs/toolkit';

import { Activity, OrganizationStatus } from '../types/activity';

// Activity summary + lifecycle intents (edit details, remove, complete/reactivate,
// add a participating org). Client -> server.

const UpdateActivity = createAction('cmd/activity/update', (updates: Partial<Activity> & { id: string }) => ({
  payload: { id: updates.id, updates },
}));

const RemoveActivity = createAction('cmd/activity/remove', (id: string) => ({
  payload: { id },
}));

const CompleteActivity = createAction('cmd/activity/complete', (id: string, endTime: number) => ({
  payload: { id, endTime },
}));

const ReactivateActivity = createAction('cmd/activity/reactivate', (id: string) => ({
  payload: { id },
}));

const AppendOrganizationTimeline = createAction('cmd/activity/appendOrg', (id: string, org: { id: string; title: string; rosterName?: string }, status: { time: number; status: OrganizationStatus }) => ({
  payload: { id, orgId: org.id, org, status },
}));

// Intent to add the operations properties (teams/comms/staff/places + default
// places) to an activity that is missing them. The server builds the default
// state so every client receives identical place ids.
const DecorateOperations = createAction('cmd/activity/decorateOps', (id: string) => ({
  payload: { id },
}));

export const ActivityCommands = {
  UpdateActivity,
  RemoveActivity,
  CompleteActivity,
  ReactivateActivity,
  AppendOrganizationTimeline,
  DecorateOperations,
};
