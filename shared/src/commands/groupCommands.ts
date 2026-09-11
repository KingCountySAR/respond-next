import { GroupEvents } from '../events/groupEvents';
import { AssignmentTarget, Group } from '../types/operations';

import { defineCommand } from './defineCommand';

// Intent to change groups, sent client -> server only. Validated by the server,
// never reduced directly, never broadcast. The server turns each into event(s).

export const GroupCommands = {
  CreateGroup: defineCommand('cmd/group/create', (activityId: string, group: Group) => ({ payload: { activityId, group } }), GroupEvents.GroupCreated),
  UpdateGroup: defineCommand('cmd/group/update', (activityId: string, group: Group) => ({ payload: { activityId, group } }), GroupEvents.GroupUpdated),
  DeleteGroup: defineCommand('cmd/group/delete', (activityId: string, id: string, target?: AssignmentTarget) => ({ payload: { activityId, id, target } }), GroupEvents.GroupDeleted),
};
