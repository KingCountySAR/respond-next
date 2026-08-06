import { createAction } from '@reduxjs/toolkit';

import { Place } from '../types/operations';

// Intent to change places, sent client -> server only. Validated by the server,
// never reduced directly, never broadcast. The server turns each into event(s).

const CreatePlace = createAction('cmd/place/create', (activityId: string, place: Place) => ({
  payload: { activityId, place },
}));

const UpdatePlace = createAction('cmd/place/update', (activityId: string, place: Place) => ({
  payload: { activityId, place },
}));

const DeletePlace = createAction('cmd/place/delete', (activityId: string, placeId: string) => ({
  payload: { activityId, placeId },
}));

const BatchUpdatePlaces = createAction('cmd/place/batchUpdate', (activityId: string, upserts: Place[], deleteIds: string[]) => ({
  payload: { activityId, upserts, deleteIds },
}));

export const PlaceCommands = {
  CreatePlace,
  UpdatePlace,
  DeletePlace,
  BatchUpdatePlaces,
};
