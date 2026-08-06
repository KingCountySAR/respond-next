import { createSlice } from '@reduxjs/toolkit';

import { BasicLocationEventReducers, BasicLocationReducers, LocationActions, LocationState } from '@respond/shared';
import { LocationEvents } from '@respond/shared/events';

import { ReducerBuilderStub } from '../types';

import { RootState } from '.';

const initialState: LocationState = {
  list: [],
};

const locationsSlice = createSlice({
  name: 'locations',
  initialState,
  reducers: {},
  extraReducers: (builder: ReducerBuilderStub<LocationState>) => {
    builder //
      // reload is the server -> client snapshot (still an action); update/remove
      // are now command/event driven.
      .addCase(LocationActions.reload, BasicLocationReducers[LocationActions.reload.type])
      .addCase(LocationEvents.LocationUpdated, BasicLocationEventReducers[LocationEvents.LocationUpdated.type])
      .addCase(LocationEvents.LocationRemoved, BasicLocationEventReducers[LocationEvents.LocationRemoved.type]);
  },
});

export default locationsSlice.reducer;

export function buildLocationSelector(id?: string) {
  return (state: RootState) => (id ? state.locations.list.find((a) => a.id === id) : undefined);
}

export function buildLocationsSelector() {
  return (state: RootState) => state.locations.list;
}
