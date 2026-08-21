import { createAction } from '@reduxjs/toolkit';

import { Team } from '../types/operations';

// Intent to change teams + the staff (role assignment) map, client -> server.
// The team-comms reactor turns status/GAR/assignment changes into comms.

const CreateTeam = createAction('cmd/team/create', (activityId: string, team: Team) => ({
  payload: { activityId, team },
}));

const UpdateTeam = createAction('cmd/team/update', (activityId: string, updates: Partial<Team> & { id: string }) => ({
  payload: { activityId, updates },
}));

const DeleteTeam = createAction('cmd/team/delete', (activityId: string, id: string) => ({
  payload: { activityId, id },
}));

const UpdateStaff = createAction('cmd/team/updateStaff', (activityId: string, staff: Record<string, string>) => ({
  payload: { activityId, staff },
}));

export const TeamCommands = {
  CreateTeam,
  UpdateTeam,
  DeleteTeam,
  UpdateStaff,
};
