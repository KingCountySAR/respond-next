import { Draft } from '@reduxjs/toolkit';
import { createNewActivity, pickActivityProperties, ResponderStatus } from '@respond/types/activity';
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

  [ActivityActions.reactivate.type]: (state, { payload }) => {
    const activity = state.list.find(f => f.id === payload.id);
    if (activity) {
      activity.endTime = null;
    }
  },

  [ActivityActions.complete.type]: (state, { payload }) => {
    const activity = state.list.find(f => f.id === payload.id);
    if (activity) {
      activity.endTime = payload.endTime;

      // Then clear every participant
      for (const pId in activity.participants) {
        const participant = activity.participants[pId]
        BasicReducers['participant/update'](state, {
          payload: {
            activityId: activity.id,
            participant: { ...participant },
            update: {
              time: payload.endTime,
              status: ResponderStatus.Cleared,
            }
          }});
      }
    }
  },

  [ActivityActions.appendOrganizationTimeline.type]: (state, { payload }) => {
    const activity = state.list.find(f => f.id === payload.activityId);
    if (activity) {
      activity.organizations[payload.orgId] = Object.assign(activity.organizations[payload.orgId] ?? { timeline: [] }, payload.org);
      activity.organizations[payload.orgId].timeline.unshift(payload.status);
    }
  },

  [ActivityActions.participantUpdate.type]: (state, { payload }) => {
    // TODO - doesn't support insert time events. Times must always be more recent than the last update.
    const activity = state.list.find(f => f.id === payload.activityId);
    if (activity) {
      console.log('found activity')
      let person = activity.participants[payload.participant.id];
      if (person) {
        console.log('found person');
        const lastUpdate = person.timeline[0];
        if (lastUpdate.organizationId !== payload.participant.organizationId) {
          if (lastUpdate.status !== ResponderStatus.Cleared && lastUpdate.status !== ResponderStatus.Unavailable) {
            person.timeline.unshift({ organizationId: lastUpdate.organizationId, time: payload.update.time, status: ResponderStatus.Cleared });
          }
          person.tags = undefined;
        } else if (lastUpdate.status === payload.update.status) {
          // Don't record updates if there's no change in status.
          return;
        }
      } else {
        person = {
          ...payload.participant,
          timeline: []
        };
        console.log('new person');
        activity.participants[payload.participant.id] = person;
      }
      Object.assign(person, payload.participant);
      person.timeline.unshift({ ... payload.update, organizationId: payload.participant.organizationId });
    }
  },

  [ActivityActions.tagParticipant.type]: (state, { payload }) => {
    const activity = state.list.find(f => f.id === payload.activityId);
    if (activity) {
      let person = activity.participants[payload.participantId];
      if (person) {
        person.tags = payload.tags;
      }
    }
  },
};