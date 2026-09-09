import { ResourceCommands } from '@shared/commands';
import { GroupEvents } from '@shared/events';

import { Reactor, ReactorContext } from './reactor';

// TeamDisbanded and TeamDeleted are both "a team is going away, reassign its
// people/equipment to `target`" — same payload shape, same follow-up
// commands. Read from `priorActivities` rather than `currentActivities`: it
// works for both (TeamDisbanded's reducer leaves the team in place, only
// TeamDeleted's reducer removes it — `prior` always still has it).
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

    if (GroupEvents.GroupsBatchChanged.match(event)) {
      const { activityId, deleteIds, target } = event.payload;
      const deletedIds = new Set(deleteIds);
      const deletedGroups = ctx.priorActivities[activityId]?.groups.filter((group) => deletedIds.has(group.id)) ?? [];

      return deletedGroups.flatMap((group) => [
        ...group.assignedParticipants.map((participantId) => ResourceCommands.AssignParticipant(activityId, participantId, target)),
        ...group.assignedEquipment.map((item) => ResourceCommands.AssignEquipment(activityId, item, target)),
      ]);
    }

    return [];
  },
};
