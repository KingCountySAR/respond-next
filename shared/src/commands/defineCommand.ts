import { createAction } from '@reduxjs/toolkit';

type Prepared<P> = { payload: P };
type EventCreator<P> = (payload: P) => { type: string; payload: P };

/**
 * Defines a command's type + payload shape. When `event` is given, the
 * command's payload maps 1:1 onto that event's payload and no server-side
 * handler is needed — dispatch auto-forwards it. Omit `event` when the
 * command needs real mapping logic (id-minting, server-authored fields,
 * etc.); those commands must get an entry in a server/src/commands/*Handlers.ts
 * file instead (enforced by a test, not silently swallowed).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defineCommand<T extends string, PC extends (...args: any[]) => Prepared<unknown>>(type: T, prepare: PC, event?: EventCreator<ReturnType<PC>['payload']>) {
  const creator = createAction(type, prepare);
  return Object.assign(creator, { event });
}
