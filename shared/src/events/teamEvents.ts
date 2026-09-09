import { createAction } from '@reduxjs/toolkit';

import { AssignmentTarget, Team } from '../types/operations';

// Facts about teams + staff assignments, minted by the server.
export const TeamEvents = {
  TeamCreated: createAction('evt/team/created', (activityId: string, team: Team) => ({
    payload: { activityId, team },
  })),
  TeamUpdated: createAction('evt/team/updated', (activityId: string, updates: Partial<Team> & { id: string }) => ({
    payload: { activityId, updates },
  })),
  TeamDisbanded: createAction('evt/team/disbanded', (activityId: string, id: string, target: AssignmentTarget) => ({
    payload: { activityId, id, target },
  })),
  TeamDeleted: createAction('evt/team/deleted', (activityId: string, id: string, target: AssignmentTarget) => ({
    payload: { activityId, id, target },
  })),
  StaffUpdated: createAction('evt/team/staffUpdated', (activityId: string, staff: Record<string, string>) => ({
    payload: { activityId, staff },
  })),
};
