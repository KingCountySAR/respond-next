import { ResourceCommands } from '@respond/shared/commands';
import { AssignmentTarget, EquipmentItem } from '@respond/shared/types/operations';

import { useAppDispatch } from '../store';

export function useResourceCommands() {
  const dispatch = useAppDispatch();

  return {
    assignParticipant: (activityId: string, participantId: string, target: AssignmentTarget) => dispatch(ResourceCommands.AssignParticipant(activityId, participantId, target)),
    assignEquipment: (activityId: string, item: EquipmentItem, target: AssignmentTarget) => dispatch(ResourceCommands.AssignEquipment(activityId, item, target)),
  };
}
