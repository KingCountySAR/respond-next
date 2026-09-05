import { LocationCommands } from '@respond/shared/commands';
import { Location } from '@respond/shared/types/location';

import { useAppDispatch } from '../store';

/**
 * Locations service (Phase 2). Components dispatch commands; ClientSync forwards
 * them and applies the LocationUpdated/LocationRemoved events into the locations
 * slice. The saved-locations catalog is broadcast to all clients.
 */
export function useLocationCommands() {
  const dispatch = useAppDispatch();

  return {
    updateLocation: (location: Partial<Location>) => dispatch(LocationCommands.UpdateLocation(location)),
    removeLocation: (locationId: string) => dispatch(LocationCommands.RemoveLocation(locationId)),
  };
}
