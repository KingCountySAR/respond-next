import type { Draft } from '@reduxjs/toolkit';
import merge from 'lodash.merge';

import { LocationEvents, LocationEventsType } from '../events/locationEvents';
import { createNewLocation, pickLocationProperties } from '../types/location';

import { LocationState } from '.';

/** Pure event-appliers for the Locations slice, keyed by location event type. */
type LocationEventReducers = {
  [K in keyof LocationEventsType as LocationEventsType[K]['type']]: (state: Draft<LocationState>, event: { payload: ReturnType<LocationEventsType[K]>['payload'] }) => void;
};

export const BasicLocationReducers: LocationEventReducers = {
  [LocationEvents.LocationUpdated.type]: function updateLocation(state, { payload }) {
    const { location } = payload;
    let target = state.list.find((f) => f.id && f.id === location.id);
    if (!target) {
      target = createNewLocation();
      state.list.push(target);
    }
    merge(target, pickLocationProperties(location));
  },

  [LocationEvents.LocationRemoved.type]: function removeLocation(state, { payload }): void {
    state.list = state.list.filter((f) => f.id !== payload.locationId);
  },
};
