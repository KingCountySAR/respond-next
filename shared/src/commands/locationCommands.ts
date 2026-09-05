import { createAction } from '@reduxjs/toolkit';

import { Location } from '../types/location';

// Intent to change the saved-locations catalog (a separate state slice from
// activities). Client -> server; no reactors.

const UpdateLocation = createAction('cmd/location/update', (location: Partial<Location>) => ({
  payload: { location },
}));

const RemoveLocation = createAction('cmd/location/remove', (locationId: string) => ({
  payload: { locationId },
}));

export const LocationCommands = {
  UpdateLocation,
  RemoveLocation,
};
