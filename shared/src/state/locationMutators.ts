import type { Draft } from '@reduxjs/toolkit';
import merge from 'lodash.merge';

import { createNewLocation, Location, pickLocationProperties } from '../types/location';

import { LocationState } from '.';

/**
 * Pure mutators for the Locations domain, shared by the legacy action reducers
 * and the command/event reducers.
 */

export function updateLocation(state: Draft<LocationState>, location: Partial<Location>): void {
  let target = state.list.find((f) => f.id && f.id === location.id);
  if (!target) {
    target = createNewLocation();
    state.list.push(target);
  }
  merge(target, pickLocationProperties(location));
}

export function removeLocation(state: Draft<LocationState>, locationId: string): void {
  state.list = state.list.filter((f) => f.id !== locationId);
}
