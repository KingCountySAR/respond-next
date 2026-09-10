import { CaseReducer } from '@reduxjs/toolkit';

// Minimal action-creator shape (RTK 2 no longer exposes the internal
// `@reduxjs/toolkit/dist/mapBuilders` TypedActionCreator).
export interface TypedActionCreator<Type extends string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any[]): { type: Type };
  type: Type;
}

export interface ReducerBuilderStub<TState> {
  addCase<ActionCreator extends TypedActionCreator<string>>(actionCreator: ActionCreator, reducer: CaseReducer<TState, ReturnType<ActionCreator>>): ReducerBuilderStub<TState>;
}
