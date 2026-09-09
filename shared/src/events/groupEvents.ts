import { createAction } from '@reduxjs/toolkit';

import { AssignmentTarget, Group } from '../types/operations';

export const GroupEvents = {
  GroupCreated: createAction('evt/group/created', (activityId: string, group: Group) => ({
    payload: { activityId, group },
  })),
  GroupUpdated: createAction('evt/group/updated', (activityId: string, group: Group) => ({
    payload: { activityId, group },
  })),
  GroupDeleted: createAction('evt/group/deleted', (activityId: string, id: string, target: AssignmentTarget) => ({
    payload: { activityId, id, target },
  })),
};
