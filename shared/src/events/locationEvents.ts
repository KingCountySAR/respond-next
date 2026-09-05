import { createAction } from '@reduxjs/toolkit';

import { Location } from '../types/location';

// Facts about the saved-locations catalog. Reduced into LocationState (not
// ActivityState), broadcast to all clients.

const LocationUpdated = createAction('evt/location/updated', (location: Partial<Location>) => ({
  payload: { location },
}));

const LocationRemoved = createAction('evt/location/removed', (locationId: string) => ({
  payload: { locationId },
}));

export const LocationEvents = {
  LocationUpdated,
  LocationRemoved,
};

export type LocationEventsType = typeof LocationEvents;
