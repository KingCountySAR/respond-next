import { ResourceCommands } from '@respond/shared/commands';
import { AssignmentTarget, EquipmentItem } from '@respond/shared/types/operations';

import { useAppDispatch } from '../store';

/**
 * Teams service (Phase 2). Components dispatch commands; ClientSync forwards
 * them and applies the events. Status/GAR/assignment comms are logged
 * server-side by the team-comms reactor — components no longer author them.
 */
export function useResourceCommands() {
  const dispatch = useAppDispatch();

  return {
    assignParticipant: (activityId: string, participantId: string, target: AssignmentTarget) => dispatch(ResourceCommands.AssignParticipant(activityId, participantId, target)),
    assignEquipment: (activityId: string, item: EquipmentItem, target: AssignmentTarget) => dispatch(ResourceCommands.AssignEquipment(activityId, item, target)),
  };
}
