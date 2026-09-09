import { createAction } from '@reduxjs/toolkit';

import { AssignmentTarget, EquipmentItem } from '../types/operations';

export const ResourceCommands = {
  AssignParticipant: createAction('cmd/resource/assignParticipant', (activityId: string, participantId: string, target?: AssignmentTarget) => ({
    payload: { activityId, participantId, target },
  })),
  AssignEquipment: createAction('cmd/resource/assignEquipment', (activityId: string, item: EquipmentItem, target?: AssignmentTarget) => ({
    payload: { activityId, item, target },
  })),
};
