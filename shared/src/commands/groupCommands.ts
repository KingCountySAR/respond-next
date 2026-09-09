import { createAction } from '@reduxjs/toolkit';

import { AssignmentTarget, Group } from '../types/operations';

export const GroupCommands = {
  CreateGroup: createAction('cmd/group/create', (activityId: string, group: Group) => ({
    payload: { activityId, group },
  })),
  UpdateGroup: createAction('cmd/group/update', (activityId: string, group: Group) => ({
    payload: { activityId, group },
  })),
  DeleteGroup: createAction('cmd/group/delete', (activityId: string, id: string, target?: AssignmentTarget) => ({
    payload: { activityId, id, target },
  })),
};
