import { CaseReducer } from '@reduxjs/toolkit';

// Minimal action-creator shape (RTK 2 no longer exposes the internal
// `@reduxjs/toolkit/dist/mapBuilders` TypedActionCreator).
export interface TypedActionCreator<Type extends string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any[]): { type: Type };
  type: Type;
}

// `Registered` accumulates the union of type-strings added so far, so a chain of
// .addCase calls carries a compile-time record of everything it handles. That
// lets callers assert exhaustiveness against a known event set (see
// assertAllEventsHandled in activities.ts). Defaults to `never` for callers that
// don't need the check.
export interface ReducerBuilderStub<TState, Registered extends string = never> {
  addCase<ActionCreator extends TypedActionCreator<string>>(actionCreator: ActionCreator, reducer: CaseReducer<TState, ReturnType<ActionCreator>>): ReducerBuilderStub<TState, Registered | ActionCreator['type']>;
}
