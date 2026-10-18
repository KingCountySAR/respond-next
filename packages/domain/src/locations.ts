/**
 * The saved-location catalog (`/api/v1/locations`): places an activity's location can be picked
 * from. Plain REST, as in the legacy app; it isn't part of activity sync.
 */
import { z } from 'zod';
import type { Location } from './schema';

export const SavedLocation = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  address: z.string().nullable(),
  description: z.string(),
});
export type SavedLocation = z.infer<typeof SavedLocation>;

/** An activity's location, from a saved one. */
export const fromSaved = (s: SavedLocation): Location => ({ title: s.title, lat: s.lat, lon: s.lon, address: s.address, savedId: s.id || null });

/** Catalog search, as the legacy route: by title, case-insensitive; an empty query lists them all. */
export const matchesLocation = (s: Pick<SavedLocation, 'title'>, query: string): boolean => s.title.toLowerCase().includes(query.trim().toLowerCase());
