import { Draft } from '@reduxjs/toolkit';
import merge from 'lodash.merge';

import { createNewActivity, ParticipantStatus, pickActivityProperties } from '@respond/types/activity';

import { ActivityActions, ActivityActionsType } from './activityActions';

import { ActivityState } from '.';

type ActivityReducers = {
  [K in keyof ActivityActionsType as ActivityActionsType[K]['type']]: (state: Draft<ActivityState>, action: { payload: ReturnType<ActivityActionsType[K]>['payload'] }) => void;
};

export const BasicReducers: ActivityReducers = {
  [ActivityActions.reload.type]: (state, { payload }) => {
    state.list = payload.list;
  },

  [ActivityActions.update.type]: (state, { payload }) => {
    let target = state.list.find((a) => a.id === payload.id);
    if (!target) {
      target = createNewActivity();
      state.list.push(target);
    }
    const trimmedToProps = pickActivityProperties(payload);
    merge(target, trimmedToProps);
  },

  [ActivityActions.remove.type]: (state, { payload }) => {
    state.list = state.list.filter((f) => f.id !== payload.id);
  },

  [ActivityActions.reactivate.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.id);
    if (activity) {
      activity.endTime = undefined;
    }
  },

  [ActivityActions.complete.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.id);
    if (activity) {
      // First set the end time
      activity.endTime = payload.endTime;

      // Then clear every participant
      for (const pId in activity.participants) {
        const participant = activity.participants[pId];
        BasicReducers['participant/update'](state, {
          payload: {
            activityId: activity.id,
            participant: {
              ...participant,
              // avoid TypeScript error abount optional vs number|undefined
              miles: participant.miles,
            },
            update: {
              time: payload.endTime,
              status: ParticipantStatus.SignedOut,
            },
          },
        });
      }
    }
  },

  [ActivityActions.appendOrganizationTimeline.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (activity) {
      activity.organizations[payload.orgId] = Object.assign(activity.organizations[payload.orgId] ?? { timeline: [] }, payload.org);
      activity.organizations[payload.orgId].timeline.unshift(payload.status);
    }
  },

  [ActivityActions.participantUpdate.type]: (state, { payload }) => {
    // TODO - doesn't support insert time events. Times must always be more recent than the last update.
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (activity) {
      let person = activity.participants[payload.participant.id];
      if (person) {
        const lastUpdate = person.timeline[0];
        if (lastUpdate.organizationId !== payload.participant.organizationId) {
          person.tags = undefined;
          const signoutFromPreviousOrg = {
            organizationId: lastUpdate.organizationId,
            time: payload.update.time,
            status: ParticipantStatus.SignedOut,
          };
          if (payload.update.status === ParticipantStatus.SignedOut) {
            // If they are logging out, log them out of the previous org, then exit.
            person.timeline.unshift(signoutFromPreviousOrg);
            return;
          } else if (lastUpdate.status !== ParticipantStatus.SignedOut && lastUpdate.status !== ParticipantStatus.NotResponding) {
            // If they are remaining active, log them out of the previous org, then continue.
            person.timeline.unshift(signoutFromPreviousOrg);
          }
        } else if (lastUpdate.status === payload.update.status) {
          // Don't record updates if there's no change in status.
          return;
        }
      } else {
        person = {
          ...payload.participant,
          timeline: [],
        };
        activity.participants[payload.participant.id] = person;
      }
      Object.assign(person, payload.participant);
      person.timeline.unshift({
        ...payload.update,
        organizationId: payload.participant.organizationId,
      });

      // If this is not a sign-in, then we are done.
      if (payload.update.status !== ParticipantStatus.SignedIn) {
        return;
      }

      // If this is a sign-in and the user is already signed into another activity, sign them out of the other activity.
      state.list
        .filter((f) => f.id !== payload.activityId && f.participants[payload.participant.id])
        .forEach((otherActivity) => {
          const timeline = otherActivity.participants[payload.participant.id].timeline;
          if (timeline[0].status === ParticipantStatus.SignedIn) {
            timeline.unshift({
              time: payload.update.time,
              status: ParticipantStatus.SignedOut,
              organizationId: timeline[0].organizationId,
            });
          }
        });
    }
  },

  [ActivityActions.participantTimelineUpdate.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    const person = activity.participants[payload.participantId];
    if (!person) {
      return;
    }
    person.timeline[payload.index] = payload.update;
  },

  [ActivityActions.participantMilesUpdate.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    const person = activity.participants[payload.participantId];
    if (!person) {
      return;
    }
    person.miles = payload.miles;
  },
    
  [ActivityActions.participantEtaUpdate.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    const person = activity.participants[payload.participantId];
    if (!person) {
      return;
    }
    
    person.eta = payload.eta;
  },

  [ActivityActions.tagParticipant.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (activity) {
      const person = activity.participants[payload.participantId];
      if (person) {
        person.tags = payload.tags;
      }
    }
  },
};
