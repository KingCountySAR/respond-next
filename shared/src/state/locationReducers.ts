import type { Draft } from '@reduxjs/toolkit';

import { LocationActions, LocationActionsType } from './locationActions';
import * as Mutators from './locationMutators';

import { LocationState } from '.';

type LocationReducers = {
  [K in keyof LocationActionsType as LocationActionsType[K]['type']]: (state: Draft<LocationState>, action: { payload: ReturnType<LocationActionsType[K]>['payload'] }) => void;
};

export const BasicReducers: LocationReducers = {
  [LocationActions.reload.type]: (state, { payload }) => {
    state.list = payload.list;
  },

  [LocationActions.update.type]: (state, { payload }) => {
    Mutators.updateLocation(state, payload);
  },

  [LocationActions.remove.type]: (state, { payload }) => {
    Mutators.removeLocation(state, payload.id);
  },
};
