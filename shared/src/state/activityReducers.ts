import type { Draft } from '@reduxjs/toolkit';
import merge from 'lodash.merge';

import { createNewActivity, ParticipantStatus, pickActivityProperties } from '../types/activity';
import { pickTeamProperties } from '../types/operations';

import { ActivityActions, ActivityActionsType } from './activityActions';
import * as Mutators from './activityMutators';

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

  [ActivityActions.createPlace.type]: (state, { payload }) => {
    Mutators.createPlace(state, payload.activityId, payload.place);
  },

  [ActivityActions.updatePlace.type]: (state, { payload }) => {
    Mutators.updatePlace(state, payload.activityId, payload.place);
  },

  [ActivityActions.deletePlace.type]: (state, { payload }) => {
    Mutators.deletePlace(state, payload.activityId, payload.placeId);
  },

  [ActivityActions.batchUpdatePlaces.type]: (state, { payload }) => {
    Mutators.batchUpdatePlaces(state, payload.activityId, payload.upserts, payload.deleteIds);
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
        Mutators.participantUpdate(
          state,
          activity.id,
          {
            id: participant.id,
            firstname: participant.firstname,
            lastname: participant.lastname,
            organizationId: participant.organizationId,
            miles: participant.miles,
            eta: participant.eta,
          },
          { time: payload.endTime, status: ParticipantStatus.SignedOut },
        );
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
    Mutators.participantUpdate(state, payload.activityId, payload.participant, payload.update);
  },

  [ActivityActions.bulkParticipantUpdate.type]: (state, { payload }) => {
    Mutators.bulkParticipantUpdate(state, payload.activityId, payload.updates);
  },

  [ActivityActions.participantTimelineUpdate.type]: (state, { payload }) => {
    Mutators.participantTimelineUpdate(state, payload.activityId, payload.participantId, payload.update, payload.index);
  },

  [ActivityActions.participantTimelineAdd.type]: (state, { payload }) => {
    Mutators.participantTimelineAdd(state, payload.activityId, payload.participantId, payload.update);
  },

  [ActivityActions.participantMilesUpdate.type]: (state, { payload }) => {
    Mutators.participantMilesUpdate(state, payload.activityId, payload.participantId, payload.miles);
  },

  [ActivityActions.participantEtaUpdate.type]: (state, { payload }) => {
    Mutators.participantEtaUpdate(state, payload.activityId, payload.participantId, payload.eta);
  },

  [ActivityActions.tagParticipant.type]: (state, { payload }) => {
    Mutators.tagParticipant(state, payload.activityId, payload.participantId, payload.tags);
  },

  [ActivityActions.createTeam.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    activity.teams = activity.teams ?? [];
    activity.teams.push(payload.team);
  },

  [ActivityActions.addComm.type]: (state, { payload }) => {
    Mutators.addComm(state, payload.activityId, payload.comm);
  },

  [ActivityActions.updateComm.type]: (state, { payload }) => {
    Mutators.updateComm(state, payload.activityId, payload.commId, payload.updates);
  },

  [ActivityActions.updateStaff.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    activity.staff = {
      ...(activity.staff ?? {}),
      ...payload.staff,
    };
  },

  [ActivityActions.updateTeam.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity || !activity.teams) {
      return;
    }
    const team = activity.teams.find((t) => t.id === payload.updates.id);
    if (!team) {
      return;
    }
    const trimmedUpdates = pickTeamProperties(payload.updates);
    Object.assign(team, trimmedUpdates);
  },
};
