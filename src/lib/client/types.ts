import { CaseReducer } from '@reduxjs/toolkit';
import { TypedActionCreator } from '@reduxjs/toolkit/dist/mapBuilders';

export interface ReducerBuilderStub<TState> {
  addCase<ActionCreator extends TypedActionCreator<string>>(actionCreator: ActionCreator, reducer: CaseReducer<TState, ReturnType<ActionCreator>>): ReducerBuilderStub<TState>;
}
