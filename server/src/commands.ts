import { v4 as uuid } from 'uuid';

import { ActivityCommands, CommsCommands, ParticipantCommands } from '@shared/commands';
import { ActivityEvents, CommsEvents, DomainEvent, ParticipantEvents } from '@shared/events';
import { createDefaultOperations, createNewCommsEntry } from '@shared/types/operations';

/** Placeholder for future server-only dependencies (DB, external services) a handler may need. Empty today. */
export type CommandServices = Record<string, never>;

export type CommandHandler<P> = (payload: P, services: CommandServices) => DomainEvent[];

type AnyCommandCreator<T extends string, P> = ((...args: never[]) => { type: T; payload: P }) & { type: T };

function defineCommandHandler<T extends string, P>(command: AnyCommandCreator<T, P>, handle: CommandHandler<P>): [T, CommandHandler<never>] {
  return [command.type, handle as CommandHandler<never>];
}

const commsCommandHandlers = [defineCommandHandler(CommsCommands.LogComm, (payload) => [CommsEvents.CommLogged({ activityId: payload.activityId, comm: createNewCommsEntry(payload.entry) })])];

const participantCommandHandlers = [
  defineCommandHandler(ParticipantCommands.UpdateParticipant, (payload) => [ParticipantEvents.ParticipantUpdated({ ...payload, update: { ...payload.update, id: uuid() } })]),
  defineCommandHandler(ParticipantCommands.AddParticipantTimeline, (payload) => [ParticipantEvents.ParticipantTimelineAdded({ ...payload, update: { ...payload.update, id: uuid() } })]),
  defineCommandHandler(ParticipantCommands.BulkUpdateParticipants, (payload) => [
    ParticipantEvents.ParticipantsBulkUpdated({
      ...payload,
      updates: payload.updates.map((u) => ({ ...u, update: { ...u.update, id: uuid() } })),
    }),
  ]),
];

const activityCommandHandlers = [defineCommandHandler(ActivityCommands.DecorateOperations, (payload) => [ActivityEvents.OperationsDecorated({ activityId: payload.activityId, operations: createDefaultOperations() })])];

// Only domains with at least one non-forwarding command appear here — Place
// and Team declare their target event directly on the command (see
// shared/src/commands/*.ts) and need no explicit handler.
export const explicitCommandHandlers: Record<string, CommandHandler<never>> = Object.fromEntries([...commsCommandHandlers, ...participantCommandHandlers, ...activityCommandHandlers]);
