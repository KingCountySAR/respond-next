import { CommsCommands, LogCommInput } from '@shared/commands';
import { GroupEvents } from '@shared/events';
import { DEFAULT_PLACES } from '@shared/types/operations';

import { Reactor, ReactorContext } from './reactor';

function establishedEntry(groupName: string): LogCommInput {
  return { from: groupName, to: DEFAULT_PLACES.base, message: `${groupName} established`, isAutomated: true };
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
      return [CommsCommands.LogComm(event.payload.activityId, establishedEntry(event.payload.group.name))];
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
        return [CommsCommands.LogComm(event.payload.activityId, assignedEntry(name, `${participant.firstname} ${participant.lastname}`))];
      }
    }

    if (GroupEvents.GroupDeleted.match(event)) {
      const prior = ctx.priorActivities[event.payload.activityId]?.groups?.find((f) => f.id === event.payload.id);
      if (!prior) return [];
      return [CommsCommands.LogComm(event.payload.activityId, terminatedEntry(prior.name))];
    }

    if (GroupEvents.GroupsBatchChanged.match(event)) {
      const { activityId, upserts, deleteIds } = event.payload;
      const prior = ctx.priorActivities[activityId];
      const current = ctx.currentActivities[activityId];
      const comms: LogCommInput[] = [];

      for (const group of upserts) {
        const priorGroup = prior?.groups?.find((candidate) => candidate.id === group.id);
        if (!priorGroup) {
          comms.push(establishedEntry(group.name));
          continue;
        }

        if (priorGroup.name !== group.name) comms.push(renamedEntry(priorGroup.name, group.name));

        if (priorGroup.leaderId !== group.leaderId) {
          if (!group.leaderId) {
            comms.push(unassignedEntry(group.name));
            continue;
          }

          const participant = current?.participants[group.leaderId];
          const assignee = participant ? `${participant.firstname} ${participant.lastname}` : group.leaderId;
          comms.push(assignedEntry(group.name, assignee));
        }
      }

      for (const groupId of deleteIds) {
        const priorGroup = prior?.groups?.find((group) => group.id === groupId);
        if (priorGroup) comms.push(terminatedEntry(priorGroup.name));
      }

      return comms.map((entry) => CommsCommands.LogComm(activityId, entry));
    }

    return [];
  },
};
