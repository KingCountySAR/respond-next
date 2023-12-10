import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Location } from '@respond/types/location';

export interface LocationsState {
  list: Location[];
}

const initialState: LocationsState = {
  list: [],
};

const locationsSlice = createSlice({
  name: 'locations',
  initialState,
  reducers: {
    update: (state: LocationsState, action: PayloadAction<LocationsState>) => {
      return Object.assign(state, action.payload);
    },
    reload: (state: LocationsState, action: PayloadAction<LocationsState>) => {
      return Object.assign(state, action.payload);
    },
  },
});

export default locationsSlice.reducer;

export const LocationActions = {
  ...locationsSlice.actions,
};
