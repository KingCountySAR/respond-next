import type { Draft } from '@reduxjs/toolkit';

import { ActivityActions, ActivityActionsType } from './activityActions';

import { ActivityState } from '.';

type ActivityReducers = {
  [K in keyof ActivityActionsType as ActivityActionsType[K]['type']]: (state: Draft<ActivityState>, action: { payload: ReturnType<ActivityActionsType[K]>['payload'] }) => void;
};

export const BasicReducers: ActivityReducers = {
  [ActivityActions.reload.type]: (state, { payload }) => {
    state.list = payload.list;
  },
};
