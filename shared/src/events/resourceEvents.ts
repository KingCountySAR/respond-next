import { createAction } from '@reduxjs/toolkit';

import { AssignmentTarget, EquipmentItem } from '../types/operations';

export const ResourceEvents = {
  ParticipantAssigned: createAction('evt/resource/participantAssigned', (activityId: string, participantId: string, target?: AssignmentTarget) => ({
    payload: { activityId, participantId, target },
  })),
  EquipmentAssigned: createAction('evt/resource/equipmentAssigned', (activityId: string, item: EquipmentItem, target?: AssignmentTarget) => ({
    payload: { activityId, item, target },
  })),
};
