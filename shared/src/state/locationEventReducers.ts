import type { Draft } from '@reduxjs/toolkit';

import { LocationEvents, LocationEventsType } from '../events/locationEvents';

import * as Mutators from './locationMutators';

import { LocationState } from '.';

/** Pure event-appliers for the Locations slice, keyed by location event type. */
type LocationEventReducers = {
  [K in keyof LocationEventsType as LocationEventsType[K]['type']]: (state: Draft<LocationState>, event: { payload: ReturnType<LocationEventsType[K]>['payload'] }) => void;
};

export const BasicLocationEventReducers: LocationEventReducers = {
  [LocationEvents.LocationUpdated.type]: (state, { payload }) => {
    Mutators.updateLocation(state, payload.location);
  },

  [LocationEvents.LocationRemoved.type]: (state, { payload }) => {
    Mutators.removeLocation(state, payload.locationId);
  },
};
