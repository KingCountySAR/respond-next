import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { ActivityState } from '@respond/shared';
import { ActivityDomainEvents } from '@respond/shared/events';

import { ReducerBuilderStub } from '../types';

import { RootState } from '.';

let initialState: ActivityState = {
  list: [],
};

if (typeof localStorage !== 'undefined' && localStorage.activities) {
  initialState = JSON.parse(localStorage.activities);
}

const activitySliceArgs = {
  name: 'activities',
  initialState,
  reducers: {
    // Full-state snapshot from the server (or localStorage rehydration). This is
    // a read-model concern, not a domain action — hence slice-local.
    reloaded: (state: ActivityState, action: PayloadAction<ActivityState>) => {
      state.list = action.payload.list;
    },
  },
  extraReducers: (builder: ReducerBuilderStub<ActivityState>) => {
    // Sourced from ActivityDomainEvents (every event has its reduce colocated
    // in shared/src/events/*.ts), so a new event can never ship without being
    // wired into the client slice. Exhaustiveness is checked at runtime by
    // store/__tests__/storeTests.ts, which asserts this set matches
    // ActivityDomainEvents.
    for (const event of Object.values(ActivityDomainEvents)) {
      builder.addCase(event as never, ((state: ActivityState, action: { payload: unknown }) => event.reduce(state, action.payload as never)) as never);
    }
  },
};

const activitiesSlice = createSlice(activitySliceArgs);

export const { reloaded: activitiesReloaded } = activitiesSlice.actions;

export default activitiesSlice.reducer;

export function buildActivitySelector(id?: string) {
  return (state: RootState) => (id ? state.activities.list.find((a) => a.id === id) : undefined);
}

export const TestBits = {
  activitySliceArgs,
};
