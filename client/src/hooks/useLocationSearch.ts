import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@respond/lib/api';
import { Location } from '@respond/shared/types/location';

const LOCATIONS_QUERY_KEY = ['locations'] as const;

/**
 * Search the saved-locations catalog over HTTP (replacing the redux slice that
 * loaded the whole catalog on every client). An empty query returns the full
 * list so a picker can still browse.
 */
export function useLocationSearch(query: string) {
  return useQuery({
    queryKey: [...LOCATIONS_QUERY_KEY, query],
    queryFn: async () => {
      const res = await apiFetch<{ data: Location[] }>(`/api/v1/locations?query=${encodeURIComponent(query)}`);
      return res.data;
    },
  });
}
