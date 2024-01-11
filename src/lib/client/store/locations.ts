import { createSlice } from '@reduxjs/toolkit';

import { BasicLocationReducers, LocationActions, LocationState } from '@respond/lib/state';

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
      .addCase(LocationActions.reload, BasicLocationReducers[LocationActions.reload.type])
      .addCase(LocationActions.update, BasicLocationReducers[LocationActions.update.type])
      .addCase(LocationActions.remove, BasicLocationReducers[LocationActions.remove.type]);
  },
});

export default locationsSlice.reducer;

export function buildLocationSelector(id?: string) {
  return (state: RootState) => (id ? state.locations.list.find((a) => a.id === id) : undefined);
}

export function buildLocationsSelector() {
  return (state: RootState) => state.locations.list;
}
