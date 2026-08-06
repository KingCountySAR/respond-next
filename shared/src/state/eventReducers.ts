import type { Draft } from '@reduxjs/toolkit';

import { DomainEvents, DomainEventsType } from '../events';

import * as Mutators from './activityMutators';

import { ActivityState } from '.';

/**
 * Pure event-appliers keyed by event type. Unlike the legacy action reducers,
 * these only ever run on server-minted events, so they need no client/server
 * branching. They reuse the same domain mutators as the action path.
 */
type EventReducers = {
  [K in keyof DomainEventsType as DomainEventsType[K]['type']]: (state: Draft<ActivityState>, event: { payload: ReturnType<DomainEventsType[K]>['payload'] }) => void;
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
};
