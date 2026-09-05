import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { BasicLocationReducers, LocationState } from '@respond/shared';
import { LocationEvents } from '@respond/shared/events';

import { ReducerBuilderStub } from '../types';

import { RootState } from '.';

const initialState: LocationState = {
  list: [],
};

const locationsSlice = createSlice({
  name: 'locations',
  initialState,
  reducers: {
    // Full-state snapshot from the server (read-model concern, slice-local).
    reloaded: (state: LocationState, action: PayloadAction<LocationState>) => {
      state.list = action.payload.list;
    },
  },
  extraReducers: (builder: ReducerBuilderStub<LocationState>) => {
    builder //
      .addCase(LocationEvents.LocationUpdated, BasicLocationReducers[LocationEvents.LocationUpdated.type])
      .addCase(LocationEvents.LocationRemoved, BasicLocationReducers[LocationEvents.LocationRemoved.type]);
  },
});

export const { reloaded: locationsReloaded } = locationsSlice.actions;

export default locationsSlice.reducer;

export function buildLocationsSelector() {
  return (state: RootState) => state.locations.list;
}
