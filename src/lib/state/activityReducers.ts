import { Draft } from '@reduxjs/toolkit';
import { createNewActivity, pickActivityProperties } from '@respond/types/activity';
import merge from 'lodash.merge';
import { ActivityState } from '.';
import { ActivityActionsType, ActivityActions } from './activityActions';

type ActivityReducers = { [K in keyof ActivityActionsType as ActivityActionsType[K]['type']]: (state: Draft<ActivityState>, action: { payload: ReturnType<ActivityActionsType[K]>['payload'] }) => void};

export const BasicReducers: ActivityReducers = {
  [ActivityActions.reload.type]: (state, { payload }) => {
    state.list = payload.list;
  },

  [ActivityActions.update.type]: (state, { payload }) => {
    let target = state.list.find(a => a.id === payload.id);
    if (!target) {
      target = createNewActivity();
      state.list.push(target);
    }
    const trimmedToProps = pickActivityProperties(payload);
    merge(target, trimmedToProps);
  },

  [ActivityActions.remove.type]: (state, { payload }) => {
    state.list = state.list.filter(f => f.id !== payload.id)
  },

  [ActivityActions.appendOrganizationTimeline.type]: (state, { payload }) => {
    const activity = state.list.find(f => f.id === payload.activityId);
    if (activity) {
      activity.organizations[payload.orgId] = Object.assign(activity.organizations[payload.orgId] ?? { timeline: [] }, payload.org);
      activity.organizations[payload.orgId].timeline.unshift(payload.status);
    }
  }
};