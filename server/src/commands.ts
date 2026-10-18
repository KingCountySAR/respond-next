import { v4 as uuid } from 'uuid';

import { ActivityCommands, CommsCommands, ParticipantCommands } from '@shared/commands';
import { ActivityEvents, CommsEvents, DomainEvent, EventAuthor, ParticipantEvents } from '@shared/events';
import { createDefaultOperations, createNewCommsEntry } from '@shared/types/operations';

/** Server-only dependencies a handler may need. */
export type CommandServices = { author?: EventAuthor };

// Participant ids are the second segment of a user's id ("<org>:<participantId>"). Reactor/service authors aren't people, so they stamp nothing.
function auditStamp(services: CommandServices): { lastUpdatedBy?: { id: string; name: string }; lastUpdatedTime?: number } {
  const author = services.author;
  if (author?.type !== 'user') return {};
  return { lastUpdatedBy: { id: author.id.split(':')[1] ?? author.id, name: author.name ?? '' }, lastUpdatedTime: Date.now() };
}

export type CommandHandler<P> = (payload: P, services: CommandServices) => DomainEvent[];

type AnyCommandCreator<T extends string, P> = ((...args: never[]) => { type: T; payload: P }) & { type: T };

function defineCommandHandler<T extends string, P>(command: AnyCommandCreator<T, P>, handle: CommandHandler<P>): [T, CommandHandler<never>] {
  return [command.type, handle as CommandHandler<never>];
}

const commsCommandHandlers = [defineCommandHandler(CommsCommands.LogComm, (payload) => [CommsEvents.CommLogged({ activityId: payload.activityId, comm: createNewCommsEntry(payload.entry) })])];

const participantCommandHandlers = [
  defineCommandHandler(ParticipantCommands.UpdateParticipant, (payload, services) => [ParticipantEvents.ParticipantUpdated({ ...payload, update: { ...payload.update, id: uuid(), ...auditStamp(services) } })]),
  defineCommandHandler(ParticipantCommands.AddParticipantTimeline, (payload, services) => [ParticipantEvents.ParticipantTimelineAdded({ ...payload, update: { ...payload.update, id: uuid(), ...auditStamp(services) } })]),
  defineCommandHandler(ParticipantCommands.UpdateParticipantTimeline, (payload, services) => [ParticipantEvents.ParticipantTimelineUpdated({ ...payload, update: { ...payload.update, ...auditStamp(services) } })]),
];

const activityCommandHandlers = [defineCommandHandler(ActivityCommands.DecorateOperations, (payload) => [ActivityEvents.OperationsDecorated({ activityId: payload.activityId, operations: createDefaultOperations() })])];

// Only domains with at least one non-forwarding command appear here — Place,
// Team, Group, and Resource all declare their target event directly on the
// command (see shared/src/commands/*.ts) and need no explicit handler.
export const explicitCommandHandlers: Record<string, CommandHandler<never>> = Object.fromEntries([...commsCommandHandlers, ...participantCommandHandlers, ...activityCommandHandlers]);
