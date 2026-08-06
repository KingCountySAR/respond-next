import { createAction } from '@reduxjs/toolkit';

import { CommunicationsLogEntry } from '../types/operations';

/**
 * The content of a comms entry a client (or reactor) wants logged. Deliberately
 * omits id / timestamp / isDeleted — the server stamps those once when it mints
 * the CommLogged event, so no client ever authors a comm id or clock value.
 */
export type LogCommInput = Pick<CommunicationsLogEntry, 'message'> & Partial<Pick<CommunicationsLogEntry, 'from' | 'to' | 'isAutomated' | 'isFavorite'>>;

const LogComm = createAction('cmd/comm/log', (activityId: string, entry: LogCommInput) => ({
  payload: { activityId, entry },
}));

const UpdateComm = createAction('cmd/comm/update', (activityId: string, commId: string, updates: Partial<CommunicationsLogEntry>) => ({
  payload: { activityId, commId, updates },
}));

export const CommsCommands = {
  LogComm,
  UpdateComm,
};
