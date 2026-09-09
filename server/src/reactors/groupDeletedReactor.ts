import { ResourceCommands } from '@shared/commands';
import { GroupEvents } from '@shared/events';

import { Reactor, ReactorContext } from './reactor';

export const groupDeleteReactor: Reactor = {
  name: 'group-deleted-reactor',

  react(event, ctx: ReactorContext) {
    if (GroupEvents.GroupDeleted.match(event)) {
      const { activityId, id, target } = event.payload;
      const group = ctx.priorActivities[activityId]?.groups.find((group) => group.id === id);
      if (!group) return [];

      return [
        ...group.assignedParticipants.map((participantId) => ResourceCommands.AssignParticipant(activityId, participantId, target)),
        ...group.assignedEquipment.map((item) => ResourceCommands.AssignEquipment(activityId, item, target)),
      ];
    }

    return [];
  },
};
