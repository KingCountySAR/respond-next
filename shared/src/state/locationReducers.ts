import type { Draft } from '@reduxjs/toolkit';

import { LocationActions, LocationActionsType } from './locationActions';

import { LocationState } from '.';

type LocationReducers = {
  [K in keyof LocationActionsType as LocationActionsType[K]['type']]: (state: Draft<LocationState>, action: { payload: ReturnType<LocationActionsType[K]>['payload'] }) => void;
};

export const BasicReducers: LocationReducers = {
  [LocationActions.reload.type]: (state, { payload }) => {
    state.list = payload.list;
  },
};
