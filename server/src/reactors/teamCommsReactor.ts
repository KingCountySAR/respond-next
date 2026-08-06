import { CommsCommands, LogCommInput } from '@respond/shared/commands';
import { TeamEvents } from '@respond/shared/events';
import { TeamStatus } from '@respond/shared/types/operations';

import { Reactor, ReactorContext } from './reactor';

// The comms text that used to be hand-dispatched from DashboardTeamStatusSelect.
const STATUS_MESSAGES: Record<TeamStatus, string> = {
  'In Base': 'In Base',
  'In Transit': 'With Transportation',
  'On Assignment': 'Starting Assignment',
  'On Scene': 'On Scene',
  'Returning To Base': 'RTB',
  Disbanded: 'Disbanded',
};

/**
 * Auto-logs the comms that used to be hand-dispatched from the team/role/status
 * UI (DashboardTeamCard GAR change, DashboardTeamStatusSelect status change,
 * DashboardRoleTile assign/unassign). Diffs prior vs current state so a comm is
 * only logged when the value actually changed — now server-authored.
 */
export const teamCommsReactor: Reactor = {
  name: 'team-comms-reactor',

  react(event, ctx: ReactorContext) {
    if (TeamEvents.TeamUpdated.match(event)) {
      const { activityId } = event.payload;
      const teamId = event.payload.updates.id;
      const prior = ctx.priorActivities[activityId]?.teams?.find((t) => t.id === teamId);
      const current = ctx.currentActivities[activityId]?.teams?.find((t) => t.id === teamId);
      if (!current) return [];

      const comms: LogCommInput[] = [];
      if (prior?.status !== current.status) {
        comms.push({ from: current.name, to: 'CP', message: STATUS_MESSAGES[current.status], isAutomated: true });
      }
      if (prior?.gar !== current.gar) {
        comms.push({ from: current.name, to: 'CP', message: `${current.name} GAR changed to ${current.gar.toUpperCase()}`, isAutomated: true, isFavorite: current.gar !== 'green' });
      }
      return comms.map((entry) => CommsCommands.LogComm(activityId, entry));
    }

    if (TeamEvents.StaffUpdated.match(event)) {
      const { activityId, staff } = event.payload;
      const prior = ctx.priorActivities[activityId];
      const current = ctx.currentActivities[activityId];

      return Object.entries(staff).flatMap(([role, value]) => {
        if (value === (prior?.staff?.[role] ?? '')) return []; // unchanged
        if (!value) {
          return [CommsCommands.LogComm(activityId, { from: 'CP', message: `${role} unassigned`, isAutomated: true })];
        }
        const participant = current?.participants[value];
        const name = participant ? `${participant.firstname} ${participant.lastname}` : value;
        return [CommsCommands.LogComm(activityId, { from: 'CP', message: `${name} assuming ${role}`, isAutomated: true })];
      });
    }

    return [];
  },
};
