import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { BasicLocationEventReducers, LocationState } from '@respond/shared';
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
      .addCase(LocationEvents.LocationUpdated, BasicLocationEventReducers[LocationEvents.LocationUpdated.type])
      .addCase(LocationEvents.LocationRemoved, BasicLocationEventReducers[LocationEvents.LocationRemoved.type]);
  },
});

export const { reloaded: locationsReloaded } = locationsSlice.actions;

export default locationsSlice.reducer;

export function buildLocationSelector(id?: string) {
  return (state: RootState) => (id ? state.locations.list.find((a) => a.id === id) : undefined);
}

export function buildLocationsSelector() {
  return (state: RootState) => state.locations.list;
}
