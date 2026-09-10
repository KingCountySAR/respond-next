import { ResourceEvents } from '../events/resourceEvents';
import { AssignmentTarget, EquipmentItem } from '../types/operations';

import { defineCommand } from './defineCommand';

// Intent to move a participant or piece of equipment to a team, place, group,
// or nowhere (unassigned). Client -> server; thin events, the reducer does the move.

export const ResourceCommands = {
  AssignParticipant: defineCommand(
    'cmd/resource/assignParticipant',
    (activityId: string, participantId: string, target?: AssignmentTarget) => ({ payload: { activityId, participantId, target } }),
    ResourceEvents.ParticipantAssigned,
  ),
  AssignEquipment: defineCommand('cmd/resource/assignEquipment', (activityId: string, item: EquipmentItem, target?: AssignmentTarget) => ({ payload: { activityId, item, target } }), ResourceEvents.EquipmentAssigned),
};
