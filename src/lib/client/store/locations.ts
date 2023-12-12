import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { createNewLocation, Location } from '@respond/types/location';

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
    update: {
      reducer: (state: LocationsState, action: PayloadAction<Location>) => {
        const target = state.list.find((f) => f.id && f.id === action.payload.id);
        if (!target) {
          return Object.assign(state, { list: [...state.list, createNewLocation(action.payload.title)] });
        }
        return Object.assign(state, { list: Object.assign(target, action.payload) });
      },
      prepare(payload: Location) {
        return { payload, meta: { sync: true } };
      },
    },
    reload: {
      reducer: (state: LocationsState, action: PayloadAction<LocationsState>) => {
        return Object.assign(state, action.payload);
      },
      prepare(payload: LocationsState) {
        return { payload, meta: { sync: true } };
      },
    },
    remove: {
      reducer: (state: LocationsState, action: PayloadAction<Location & { id: string }>) => {
        return Object.assign(state, { list: state.list.filter((f) => f.id !== action.payload.id) });
      },
      prepare(payload: Location) {
        return { payload, meta: { sync: true } };
      },
    },
  },
});

export default locationsSlice.reducer;

export const LocationActions = {
  ...locationsSlice.actions,
};

export type LocationActionsType = typeof LocationActions;
type AllLocationActions = {
  [K in keyof LocationActionsType]: ReturnType<LocationActionsType[K]>;
};
export type LocationAction = AllLocationActions[keyof AllLocationActions];
