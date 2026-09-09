import { apiFetch } from '@respond/lib/api';
import { Location } from '@respond/shared/types/location';

/**
 * No observable state here yet
 * (nothing currently needs to react to a mutation beyond the caller's own
 * `onSubmit`), but this gives the two call sites (`LocationEditDialog`,
 * `LocationManager`) one place to share instead of each hitting `apiFetch`
 * directly, and a home to grow into if a consumer ends up needing an
 * observable list.
 */
export class LocationsStore {
  update(location: Partial<Location>): Promise<void> {
    return apiFetch('/api/v1/locations', { method: 'PUT', body: JSON.stringify(location) });
  }

  remove(locationId: string): Promise<void> {
    return apiFetch(`/api/v1/locations/${locationId}`, { method: 'DELETE' });
  }
}
