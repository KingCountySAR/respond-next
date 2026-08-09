import { CaseReducer } from '@reduxjs/toolkit';
import { ActivityState } from '@respond/shared';
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
  it('includes reducers for all activity-domain events', () => {
    // If we forget to add an event to the .addCase()'s in activitySliceArgs, we'll silently ignore it
    // in the client store. This test makes sure the slice's extraReducers register every activity-domain
    // event (location events go in the locations slice; the reload snapshot is a slice-local reducer).
    const expectedActionTypes = Object.values(ActivityDomainEvents)
      .map((ac) => ac.type)
      .sort();

    const builder = new TestBuilder();
    TestBits.activitySliceArgs.extraReducers(builder);

    expect(builder.typeList.sort()).toEqual(expectedActionTypes);
  });
});
