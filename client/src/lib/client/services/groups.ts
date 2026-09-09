import { GroupCommands, ResourceCommands } from '@respond/shared/commands';
import { AssignmentTarget, EquipmentItem, Group } from '@respond/shared/types/operations';

import { useAppDispatch } from '../store';

export function useGroupCommands() {
  const dispatch = useAppDispatch();

  return {
    createGroup: (activityId: string, group: Group) => dispatch(GroupCommands.CreateGroup(activityId, group)),
    updateGroup: (activityId: string, group: Group) => dispatch(GroupCommands.UpdateGroup(activityId, group)),
    deleteGroup: (activityId: string, id: string, target?: AssignmentTarget) => dispatch(GroupCommands.DeleteGroup(activityId, id, target)),
    assignParticipant: (activityId: string, participantId: string, target: AssignmentTarget) => dispatch(ResourceCommands.AssignParticipant(activityId, participantId, target)),
    assignEquipment: (activityId: string, item: EquipmentItem, target: AssignmentTarget) => dispatch(ResourceCommands.AssignEquipment(activityId, item, target)),
  };
}
