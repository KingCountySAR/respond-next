import { CommsCommands, LogCommInput } from '@shared/commands';
import { GroupEvents } from '@shared/events';
import { DEFAULT_PLACES } from '@shared/types/operations';

import { Reactor, ReactorContext } from './reactor';

function establishedEntry(groupName: string, assignee: string): LogCommInput {
  return { from: groupName, to: DEFAULT_PLACES.base, message: `${groupName} established; ${assignee} is assuming ${groupName}`, isAutomated: true };
}

function terminatedEntry(groupName: string): LogCommInput {
  return { from: groupName, to: DEFAULT_PLACES.base, message: `${groupName} terminated`, isAutomated: true };
}

function assignedEntry(groupName: string, assignee: string): LogCommInput {
  return { from: groupName, to: DEFAULT_PLACES.base, message: `${assignee} is assuming ${groupName}`, isAutomated: true };
}

function unassignedEntry(groupName: string): LogCommInput {
  return { from: groupName, to: DEFAULT_PLACES.base, message: `${groupName} unassigned`, isAutomated: true };
}

function renamedEntry(oldName: string, newName: string): LogCommInput {
  return { from: newName, to: DEFAULT_PLACES.base, message: `${oldName} renamed to ${newName}`, isAutomated: true };
}

export const groupCommsReactor: Reactor = {
  name: 'group-comms-reactor',

  react(event, ctx: ReactorContext) {
    if (GroupEvents.GroupCreated.match(event)) {
      const { activityId, group } = event.payload;
      // A group is only "established" in the log once it has a leader.
      if (!group.leaderId) return [];
      const leader = ctx.currentActivities[activityId]?.participants[group.leaderId];
      if (!leader) return [];
      return [CommsCommands.LogComm(activityId, establishedEntry(group.name, `${leader.firstname} ${leader.lastname}`))];
    }

    if (GroupEvents.GroupUpdated.match(event)) {
      const prior = ctx.priorActivities[event.payload.activityId]?.groups?.find((f) => f.id === event.payload.group.id);
      if (!prior) return [];
      const activity = ctx.currentActivities[event.payload.activityId];
      const { name, leaderId } = event.payload.group;

      if (prior.name !== name) {
        return [CommsCommands.LogComm(event.payload.activityId, renamedEntry(prior.name, name))];
      }

      if (prior.leaderId !== leaderId) {
        if (!leaderId) return [CommsCommands.LogComm(event.payload.activityId, unassignedEntry(event.payload.group.name))];
        const participant = activity.participants[leaderId];
        const assignee = `${participant.firstname} ${participant.lastname}`;
        const entry = prior.leaderId ? assignedEntry(name, assignee) : establishedEntry(name, assignee);
        return [CommsCommands.LogComm(event.payload.activityId, entry)];
      }
    }

    if (GroupEvents.GroupDeleted.match(event)) {
      const prior = ctx.priorActivities[event.payload.activityId]?.groups?.find((f) => f.id === event.payload.id);
      if (!prior) return [];
      return [CommsCommands.LogComm(event.payload.activityId, terminatedEntry(prior.name))];
    }

    return [];
  },
};
