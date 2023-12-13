import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { createNewLocation, Location } from '@respond/types/location';

import { RootState } from '.';

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
          const newLocation = Object.assign(createNewLocation(action.payload.title), action.payload);
          return Object.assign(state, { list: [...state.list, newLocation] });
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

export function buildLocationSelector(id?: string) {
  return (state: RootState) => (id ? state.locations.list.find((a) => a.id === id) : undefined);
}

export function buildLocationsSelector() {
  return (state: RootState) => state.locations.list;
}
