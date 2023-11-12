import { CaseReducer } from '@reduxjs/toolkit';
import { TypedActionCreator } from '@reduxjs/toolkit/dist/mapBuilders';

import { ActivityActions, ActivityState } from '@respond/lib/state';

import { ReducerBuilderStub, TestBits } from '../activities';

/**
 * Collects a list of action types that are added to the slice's extraReducers in createSlice(...).
 */
class TestBuilder implements ReducerBuilderStub {
  typeList: string[] = [];

  addCase<ActionCreator extends TypedActionCreator<string>>(actionCreator: ActionCreator, _reducer: CaseReducer<ActivityState, ReturnType<ActionCreator>>): ReducerBuilderStub {
    this.typeList.push(actionCreator.type);
    return this;
  }
}

describe('Client Store', () => {
  it('includes reducers for all activity actions', () => {
    // If we forget to add actions to the list of .addCase()'s in activitySliceArgs, we'll silently ignore
    // those actions in the client store. This test makes sure we're registering reducers for each action type.

    // If there end up being actions that shouldn't have a reducer in the client store,
    // filter the expectedActionTypes
    const expectedActionTypes = Object.values(ActivityActions)
      .map((ac) => ac.type)
      .sort();

    const builder = new TestBuilder();
    TestBits.activitySliceArgs.extraReducers(builder);

    expect(builder.typeList.sort()).toEqual(expectedActionTypes);
  });
});
