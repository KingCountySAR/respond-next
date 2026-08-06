import type { Draft } from '@reduxjs/toolkit';

import { ActivityDomainEvents, ActivityDomainEventsType, DomainEvents } from '../events';

import * as Mutators from './activityMutators';

import { ActivityState } from '.';

/**
 * Pure event-appliers keyed by event type. Unlike the legacy action reducers,
 * these only ever run on server-minted events, so they need no client/server
 * branching. They reuse the same domain mutators as the action path. Location
 * events are reduced separately (BasicLocationEventReducers) into LocationState.
 */
type EventReducers = {
  [K in keyof ActivityDomainEventsType as ActivityDomainEventsType[K]['type']]: (state: Draft<ActivityState>, event: { payload: ReturnType<ActivityDomainEventsType[K]>['payload'] }) => void;
};

export const BasicEventReducers: EventReducers = {
  [DomainEvents.PlaceCreated.type]: (state, { payload }) => {
    Mutators.createPlace(state, payload.activityId, payload.place);
  },

  [DomainEvents.PlaceUpdated.type]: (state, { payload }) => {
    Mutators.updatePlace(state, payload.activityId, payload.place);
  },

  [DomainEvents.PlaceDeleted.type]: (state, { payload }) => {
    Mutators.deletePlace(state, payload.activityId, payload.placeId);
  },

  [DomainEvents.PlacesBatchChanged.type]: (state, { payload }) => {
    Mutators.batchUpdatePlaces(state, payload.activityId, payload.upserts, payload.deleteIds);
  },

  [DomainEvents.CommLogged.type]: (state, { payload }) => {
    Mutators.addComm(state, payload.activityId, payload.comm);
  },

  [DomainEvents.CommUpdated.type]: (state, { payload }) => {
    Mutators.updateComm(state, payload.activityId, payload.commId, payload.updates);
  },

  [DomainEvents.ParticipantUpdated.type]: (state, { payload }) => {
    Mutators.participantUpdate(state, payload.activityId, payload.participant, payload.update);
  },

  [DomainEvents.ParticipantTimelineAdded.type]: (state, { payload }) => {
    Mutators.participantTimelineAdd(state, payload.activityId, payload.participantId, payload.update);
  },

  [DomainEvents.ParticipantTimelineUpdated.type]: (state, { payload }) => {
    Mutators.participantTimelineUpdate(state, payload.activityId, payload.participantId, payload.update, payload.index);
  },

  [DomainEvents.ParticipantMilesUpdated.type]: (state, { payload }) => {
    Mutators.participantMilesUpdate(state, payload.activityId, payload.participantId, payload.miles);
  },

  [DomainEvents.ParticipantEtaUpdated.type]: (state, { payload }) => {
    Mutators.participantEtaUpdate(state, payload.activityId, payload.participantId, payload.eta);
  },

  [DomainEvents.ParticipantsBulkUpdated.type]: (state, { payload }) => {
    Mutators.bulkParticipantUpdate(state, payload.activityId, payload.updates);
  },

  [DomainEvents.ParticipantTagged.type]: (state, { payload }) => {
    Mutators.tagParticipant(state, payload.activityId, payload.participantId, payload.tags);
  },

  [DomainEvents.TeamCreated.type]: (state, { payload }) => {
    Mutators.createTeam(state, payload.activityId, payload.team);
  },

  [DomainEvents.TeamUpdated.type]: (state, { payload }) => {
    Mutators.updateTeam(state, payload.activityId, payload.updates);
  },

  [DomainEvents.StaffUpdated.type]: (state, { payload }) => {
    Mutators.updateStaff(state, payload.activityId, payload.staff);
  },
};
