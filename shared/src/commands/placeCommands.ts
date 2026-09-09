import { createAction } from '@reduxjs/toolkit';

import { AssignmentTarget, Place } from '../types/operations';

// Intent to change places, sent client -> server only. Validated by the server,
// never reduced directly, never broadcast. The server turns each into event(s).

export const PlaceCommands = {
  CreatePlace: createAction('cmd/place/create', (activityId: string, place: Place) => ({
    payload: { activityId, place },
  })),
  UpdatePlace: createAction('cmd/place/update', (activityId: string, place: Place) => ({
    payload: { activityId, place },
  })),
  DeletePlace: createAction('cmd/place/delete', (activityId: string, placeId: string, target?: AssignmentTarget) => ({
    payload: { activityId, placeId, target },
  })),
  BatchUpdatePlaces: createAction('cmd/place/batchUpdate', (activityId: string, upserts: Place[], deleteIds: string[], target?: AssignmentTarget) => ({
    payload: { activityId, upserts, deleteIds, target },
  })),
};
