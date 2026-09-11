import { TeamEvents } from '../events/teamEvents';
import { AssignmentTarget, Team } from '../types/operations';

import { defineCommand } from './defineCommand';

// Intent to change teams + the staff (role assignment) map, client -> server.
// The team-comms reactor turns status/GAR/assignment changes into comms.
// Every command here forwards straight through to its matching event.
// Participant/equipment assignment moved to resourceCommands.ts.

export const TeamCommands = {
  CreateTeam: defineCommand('cmd/team/create', (activityId: string, team: Team) => ({ payload: { activityId, team } }), TeamEvents.TeamCreated),
  UpdateTeam: defineCommand('cmd/team/update', (activityId: string, updates: Partial<Team> & { id: string }) => ({ payload: { activityId, updates } }), TeamEvents.TeamUpdated),
  DisbandTeam: defineCommand('cmd/team/disband', (activityId: string, id: string, target?: AssignmentTarget) => ({ payload: { activityId, id, target } }), TeamEvents.TeamDisbanded),
  DeleteTeam: defineCommand('cmd/team/delete', (activityId: string, id: string, target?: AssignmentTarget) => ({ payload: { activityId, id, target } }), TeamEvents.TeamDeleted),
  UpdateStaff: defineCommand('cmd/team/updateStaff', (activityId: string, staff: Record<string, string>) => ({ payload: { activityId, staff } }), TeamEvents.StaffUpdated),
};
