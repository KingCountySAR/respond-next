import { CommsEvents } from '../events/commsEvents';
import { CommunicationsLogEntry } from '../types/operations';

import { defineCommand } from './defineCommand';

/**
 * The content of a comms entry a client (or reactor) wants logged. Deliberately
 * omits id / timestamp / isDeleted — the server stamps those once when it mints
 * the CommLogged event, so no client ever authors a comm id or clock value.
 */
export type LogCommInput = Pick<CommunicationsLogEntry, 'message'> & Partial<Pick<CommunicationsLogEntry, 'from' | 'to' | 'isAutomated' | 'isFavorite'>>;

export const CommsCommands = {
  LogComm: defineCommand('cmd/comm/log', (activityId: string, entry: LogCommInput) => ({ payload: { activityId, entry } })),
  UpdateComm: defineCommand('cmd/comm/update', (activityId: string, commId: string, updates: Partial<CommunicationsLogEntry>) => ({ payload: { activityId, commId, updates } }), CommsEvents.CommUpdated),
};
