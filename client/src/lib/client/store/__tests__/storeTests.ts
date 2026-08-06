import { CaseReducer } from '@reduxjs/toolkit';

import { ActivityActions, ActivityState } from '@respond/shared';
import { ActivityDomainEvents } from '@respond/shared/events';

import { ReducerBuilderStub, TypedActionCreator } from '../../types';
import { TestBits } from '../activities';

/**
 * Collects a list of action types that are added to the slice's extraReducers in createSlice(...).
 */
class TestBuilder implements ReducerBuilderStub<ActivityState> {
  typeList: string[] = [];

  addCase<ActionCreator extends TypedActionCreator<string>>(actionCreator: ActionCreator, _reducer: CaseReducer<ActivityState, ReturnType<ActionCreator>>): ReducerBuilderStub<ActivityState> {
    this.typeList.push(actionCreator.type);
    return this;
  }
}

describe('Client Store', () => {
  it('includes reducers for all activity actions', () => {
    // If we forget to add actions to the list of .addCase()'s in activitySliceArgs, we'll silently ignore
    // those actions in the client store. This test makes sure we're registering reducers for each action type.

    // If there end up being actions that shouldn't have a reducer in the client store,
    // filter the expectedActionTypes. The activities slice reduces the legacy activity
    // actions and the activity-domain events (location events go in the locations slice).
    const expectedActionTypes = [...Object.values(ActivityActions).map((ac) => ac.type), ...Object.values(ActivityDomainEvents).map((ac) => ac.type)].sort();

    const builder = new TestBuilder();
    TestBits.activitySliceArgs.extraReducers(builder);

    expect(builder.typeList.sort()).toEqual(expectedActionTypes);
  });
});
