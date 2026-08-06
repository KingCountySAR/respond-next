import { createAction } from '@reduxjs/toolkit';

import { LocationState } from '.';

const reload = createAction('locations/load', (payload: LocationState) => ({
  payload,
}));

export const LocationActions = {
  reload,
};

export type LocationActionsType = typeof LocationActions;
