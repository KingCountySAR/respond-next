import { TeamCommands } from '@shared/commands';
import { TeamEvents } from '@shared/events';

import { Reactor, ReactorContext } from './reactor';

// TeamDisbanded and TeamDeleted are both "a team is going away, reassign its
// people/equipment to `target`" — same payload shape, same follow-up
// commands. Read from `priorActivities` rather than `currentActivities`: it
// works for both (TeamDisbanded's reducer leaves the team in place, only
// TeamDeleted's reducer removes it — `prior` always still has it).
export const teamDisbandReactor: Reactor = {
  name: 'team-disband-reactor',

  react(event, ctx: ReactorContext) {
    if (!TeamEvents.TeamDisbanded.match(event) && !TeamEvents.TeamDeleted.match(event)) return [];

    const { activityId, id, target } = event.payload;
    const team = ctx.priorActivities[activityId]?.teams.find((t) => t.id === id);
    if (!team) return [];

    return [
      //
      ...team.assignedParticipants.map((pId) => TeamCommands.AssignTeamMember(activityId, pId, target)),
      ...team.assignedEquipment.map((item) => TeamCommands.AssignEquipment(activityId, item, target)),
    ];
  },
};
