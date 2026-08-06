import { createAction } from '@reduxjs/toolkit';

import { Team } from '../types/operations';

// Facts about teams + staff assignments, minted by the server.

const TeamCreated = createAction('evt/team/created', (activityId: string, team: Team) => ({
  payload: { activityId, team },
}));

const TeamUpdated = createAction('evt/team/updated', (activityId: string, updates: Partial<Team> & { id: string }) => ({
  payload: { activityId, updates },
}));

const StaffUpdated = createAction('evt/team/staffUpdated', (activityId: string, staff: Record<string, string>) => ({
  payload: { activityId, staff },
}));

export const TeamEvents = {
  TeamCreated,
  TeamUpdated,
  StaffUpdated,
};
