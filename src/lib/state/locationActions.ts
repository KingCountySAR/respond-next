import { createAction } from '@reduxjs/toolkit';

import { Location } from '@respond/types/location';

import { LocationState } from '.';

const reload = createAction('locations/load', (payload: LocationState) => ({
  payload,
  meta: { sync: false },
}));

const update = createAction('locations/update', (payload: Location) => ({
  payload,
  meta: { sync: false },
}));

const remove = createAction('locations/remove', (payload: Location) => ({
  payload,
  meta: { sync: false },
}));

export const LocationActions = {
  reload,
  update,
  remove,
};

export type LocationActionsType = typeof LocationActions;
type AllLocationActions = {
  [K in keyof LocationActionsType]: ReturnType<LocationActionsType[K]>;
};
export type LocationAction = AllLocationActions[keyof AllLocationActions];

export function isLocationAction(object: { type: string }): object is LocationAction {
  return Object.values(LocationActions).some((a) => a.type === object.type);
}
