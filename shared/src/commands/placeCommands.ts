import { PlaceEvents } from '../events/placeEvents';
import { Place } from '../types/operations';

import { defineCommand } from './defineCommand';

// Intent to change places, sent client -> server only. Validated by the server,
// never reduced directly, never broadcast. The server turns each into event(s).

export const PlaceCommands = {
  CreatePlace: defineCommand('cmd/place/create', (activityId: string, place: Place) => ({ payload: { activityId, place } }), PlaceEvents.PlaceCreated),
  UpdatePlace: defineCommand('cmd/place/update', (activityId: string, place: Place) => ({ payload: { activityId, place } }), PlaceEvents.PlaceUpdated),
  DeletePlace: defineCommand('cmd/place/delete', (activityId: string, placeId: string) => ({ payload: { activityId, placeId } }), PlaceEvents.PlaceDeleted),
  BatchUpdatePlaces: defineCommand('cmd/place/batchUpdate', (activityId: string, upserts: Place[], deleteIds: string[]) => ({ payload: { activityId, upserts, deleteIds } }), PlaceEvents.PlacesBatchChanged),
};
