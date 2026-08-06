import { PlaceCommands } from '@respond/shared/commands';
import { Place } from '@respond/shared/types/operations';

import { useAppDispatch } from '../store';

/**
 * Places service (Phase 2). Components call these instead of dispatching
 * reducers directly; each dispatches a command that ClientSync forwards to the
 * server. The authoritative event comes back over the socket and updates state.
 * Automated comms (place established/terminated) are emitted server-side by the
 * place-comms reactor — components no longer author them.
 */
export function usePlaceCommands() {
  const dispatch = useAppDispatch();

  return {
    createPlace: (activityId: string, place: Place) => dispatch(PlaceCommands.CreatePlace(activityId, place)),
    updatePlace: (activityId: string, place: Place) => dispatch(PlaceCommands.UpdatePlace(activityId, place)),
    deletePlace: (activityId: string, placeId: string) => dispatch(PlaceCommands.DeletePlace(activityId, placeId)),
    batchUpdatePlaces: (activityId: string, upserts: Place[], deleteIds: string[]) => dispatch(PlaceCommands.BatchUpdatePlaces(activityId, upserts, deleteIds)),
  };
}
