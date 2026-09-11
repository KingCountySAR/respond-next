import { ActivityEvents } from '../events/activityEvents';
import { Activity, OrganizationStatus } from '../types/activity';

import { defineCommand } from './defineCommand';

export const ActivityCommands = {
  UpdateActivity: defineCommand('cmd/activity/update', (updates: Partial<Activity> & { id: string }) => ({ payload: { updates } }), ActivityEvents.ActivityUpdated),
  RemoveActivity: defineCommand('cmd/activity/remove', (activityId: string) => ({ payload: { activityId } }), ActivityEvents.ActivityRemoved),
  CompleteActivity: defineCommand('cmd/activity/complete', (activityId: string, endTime: number) => ({ payload: { activityId, endTime } }), ActivityEvents.ActivityCompleted),
  ReactivateActivity: defineCommand('cmd/activity/reactivate', (activityId: string) => ({ payload: { activityId } }), ActivityEvents.ActivityReactivated),
  AppendOrganizationTimeline: defineCommand(
    'cmd/activity/appendOrg',
    (activityId: string, org: { id: string; title: string; rosterName?: string }, status: { time: number; status: OrganizationStatus }) => ({ payload: { activityId, orgId: org.id, org, status } }),
    ActivityEvents.OrganizationTimelineAppended,
  ),
  DecorateOperations: defineCommand('cmd/activity/decorateOps', (activityId: string) => ({ payload: { activityId } })),
};
