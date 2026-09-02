import { TeamCommands } from '@shared/commands';
import { TeamEvents } from '@shared/events';

import { Reactor, ReactorContext } from './reactor';

export const teamDisbandReactor: Reactor = {
  name: 'team-disband-reactor',

  react(event, ctx: ReactorContext) {
    if (!TeamEvents.TeamDisbanded.match(event)) return [];

    const { activityId, id, target } = event.payload;
    const team = ctx.currentActivities[activityId]?.teams.find((t) => t.id === id);
    if (!team) return [];

    return [
      //
      ...team.assignedParticipants.map((pId) => TeamCommands.AssignTeamMember(activityId, pId, target)),
      ...team.assignedEquipment.map((item) => TeamCommands.AssignEquipment(activityId, item, target)),
    ];
  },
};
