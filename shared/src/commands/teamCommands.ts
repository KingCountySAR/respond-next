import { createAction } from '@reduxjs/toolkit';

import { AssignmentTarget, Team } from '../types/operations';

// Intent to change teams + the staff (role assignment) map, client -> server.
// The team-comms reactor turns status/GAR/assignment changes into comms.

export const TeamCommands = {
  CreateTeam: createAction('cmd/team/create', (activityId: string, team: Team) => ({
    payload: { activityId, team },
  })),
  UpdateTeam: createAction('cmd/team/update', (activityId: string, updates: Partial<Team> & { id: string }) => ({
    payload: { activityId, updates },
  })),
  DeleteTeam: createAction('cmd/team/delete', (activityId: string, id: string) => ({
    payload: { activityId, id },
  })),
  UpdateStaff: createAction('cmd/team/updateStaff', (activityId: string, staff: Record<string, string>) => ({
    payload: { activityId, staff },
  })),
  AssignTeamMember: createAction('cmd/team/assignMember', (activityId: string, participantId: string, target?: AssignmentTarget) => ({
    payload: { activityId, participantId, target },
  })),
};
