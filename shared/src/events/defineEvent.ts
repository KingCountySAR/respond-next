import { createAction, type Draft } from '@reduxjs/toolkit';

/** Slot for future rich-text/ReactNode audit-log formatting. Unused today. */
export type EventFormatter<P> = (payload: P) => unknown;

export function defineEvent<S, P>(type: string, reduce: (state: Draft<S>, payload: P) => void, options?: { format?: EventFormatter<P> }) {
  const creator = createAction<P>(type);
  return Object.assign(creator, { reduce, format: options?.format });
}
