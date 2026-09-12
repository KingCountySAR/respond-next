import type { Draft } from '@reduxjs/toolkit';

import type { ActivityState } from '..';
import { CommandError } from '../commands/commandError';

import { defineEvent } from './defineEvent';

export type CommandFailedPayload = { commandId: string; message: string; code?: string };

/**
 * Server -> the single client whose command failed (see CommandError). Never
 * mutates ActivityState — reduce is a no-op — and never persisted or
 * broadcast to anyone else. Built by whatever layer knows which connection
 * issued the command (socketManager.ts), not by StateManager itself.
 */
export const SystemEvents = {
  CommandFailed: defineEvent('evt/system/commandFailed', (_state: Draft<ActivityState>, _payload: CommandFailedPayload) => undefined),
};

/**
 * Translate a caught error into a CommandFailed payload: a known CommandError
 * becomes its own message/code; anything else is masked with a generic
 * message so internal error details (message, stack) never reach the client.
 * Callers should still log the original error server-side in that case.
 */
export function toCommandFailedPayload(err: unknown, commandId: string): CommandFailedPayload {
  if (err instanceof CommandError) {
    return { commandId, message: err.message, code: err.code };
  }
  return { commandId, message: 'An unexpected error occurred.', code: 'INTERNAL_ERROR' };
}
