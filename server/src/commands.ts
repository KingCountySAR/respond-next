import { v4 as uuid } from 'uuid';

import { ActivityCommands, CommsCommands, ParticipantCommands, TeamCommands } from '@shared/commands';
import { ActivityEvents, CommsEvents, DomainEvent, ParticipantEvents, TeamEvents } from '@shared/events';
import type { Activity } from '@shared/types/activity';
import { createDefaultOperations, createNewCommsEntry, createNewTeam, getNextTeamNumber } from '@shared/types/operations';

/** Server-only dependencies a handler may need. */
export type CommandServices = { activities?: Activity[] };

export type CommandHandler<P> = (payload: P, services: CommandServices) => DomainEvent[];

type AnyCommandCreator<T extends string, P> = ((...args: never[]) => { type: T; payload: P }) & { type: T };

function defineCommandHandler<T extends string, P>(command: AnyCommandCreator<T, P>, handle: CommandHandler<P>): [T, CommandHandler<never>] {
  return [command.type, handle as CommandHandler<never>];
}

const commsCommandHandlers = [defineCommandHandler(CommsCommands.LogComm, (payload) => [CommsEvents.CommLogged({ activityId: payload.activityId, comm: createNewCommsEntry(payload.entry) })])];

const participantCommandHandlers = [
  defineCommandHandler(ParticipantCommands.UpdateParticipant, (payload) => [ParticipantEvents.ParticipantUpdated({ ...payload, update: { ...payload.update, id: uuid() } })]),
  defineCommandHandler(ParticipantCommands.AddParticipantTimeline, (payload) => [ParticipantEvents.ParticipantTimelineAdded({ ...payload, update: { ...payload.update, id: uuid() } })]),
];

const activityCommandHandlers = [defineCommandHandler(ActivityCommands.DecorateOperations, (payload) => [ActivityEvents.OperationsDecorated({ activityId: payload.activityId, operations: createDefaultOperations() })])];

const teamCommandHandlers = [
  defineCommandHandler(TeamCommands.CreateTeam, (payload, services) => {
    const activity = services.activities?.find((a) => a.id === payload.activityId);
    if (!activity) return [];
    return [TeamEvents.TeamCreated({ activityId: payload.activityId, team: createNewTeam(`Team ${getNextTeamNumber(activity.teams)}`) })];
  }),
];

// Only domains with at least one non-forwarding command appear here — Place,
// Team, Group, and Resource all declare their target event directly on the
// command (see shared/src/commands/*.ts) and need no explicit handler.
export const explicitCommandHandlers: Record<string, CommandHandler<never>> = Object.fromEntries([...commsCommandHandlers, ...participantCommandHandlers, ...activityCommandHandlers, ...teamCommandHandlers]);
