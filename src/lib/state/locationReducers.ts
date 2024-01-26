import { Draft } from '@reduxjs/toolkit';
import merge from 'lodash.merge';

import { createNewLocation, pickLocationProperties } from '@respond/types/location';

import { LocationActions, LocationActionsType } from './locationActions';

import { LocationState } from '.';

type LocationReducers = {
  [K in keyof LocationActionsType as LocationActionsType[K]['type']]: (state: Draft<LocationState>, action: { payload: ReturnType<LocationActionsType[K]>['payload'] }) => void;
};

export const BasicReducers: LocationReducers = {
  [LocationActions.reload.type]: (state, { payload }) => {
    state.list = payload.list;
  },

  [LocationActions.update.type]: (state, { payload }) => {
    let target = state.list.find((f) => f.id && f.id === payload.id);
    if (!target) {
      target = createNewLocation();
      state.list.push(target);
    }
    const props = pickLocationProperties(payload);
    merge(target, props);
  },

  [LocationActions.remove.type]: (state, { payload }) => {
    state.list = state.list.filter((f) => f.id !== payload.id);
  },
};
