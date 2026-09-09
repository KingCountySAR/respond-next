import { createAction } from '@reduxjs/toolkit';

import { AssignmentTarget, Place } from '../types/operations';

// Facts about places, minted by the server and broadcast to all clients.
// Reduced by event type in shared/state/eventReducers.

const PlaceCreated = createAction('evt/place/created', (activityId: string, place: Place) => ({
  payload: { activityId, place },
}));

const PlaceUpdated = createAction('evt/place/updated', (activityId: string, place: Place) => ({
  payload: { activityId, place },
}));

const PlaceDeleted = createAction('evt/place/deleted', (activityId: string, placeId: string, target: AssignmentTarget) => ({
  payload: { activityId, placeId, target },
}));

const PlacesBatchChanged = createAction('evt/place/batchChanged', (activityId: string, upserts: Place[], deleteIds: string[], target: AssignmentTarget) => ({
  payload: { activityId, upserts, deleteIds, target },
}));

export const PlaceEvents = {
  PlaceCreated,
  PlaceUpdated,
  PlaceDeleted,
  PlacesBatchChanged,
};
