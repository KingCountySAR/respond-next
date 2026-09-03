import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';

import { LocationEvents, userAuthor } from '@shared/events';
import type { Location } from '@shared/types/location';

import { getAuthFromContext, userFromAuth } from '../auth';
import mongoPromise from '../mongodb';
import { getServices } from '../services';

const LOCATIONS_COLLECTION = 'locations';

export const locationsRoutes = new Hono();

// On-demand location search (replaces pushing the whole catalog to every client
// in the connect snapshot). Filters the catalog by title; an empty query
// returns the full list so a picker can still browse. StateManager doesn't
// cache a locations read model, so this queries Mongo directly.
locationsRoutes.get('/v1/locations', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  const query = c.req.query('query')?.trim().toLowerCase() ?? '';
  const mongo = await mongoPromise;
  const all = await mongo
    .db()
    .collection<Location>(LOCATIONS_COLLECTION)
    .find()
    .map((loc) => {
      const { _id, ...rest } = loc;
      return rest;
    })
    .toArray();
  const data = query ? all.filter((l) => l.title.toLowerCase().includes(query)) : all;
  return c.json({ status: 'ok', data });
});

// Mutations write straight to Mongo here instead of going through the command
// pipeline (locations aren't part of the live activity sync), then hand the
// resulting event to StateManager.broadcastEvents, which just logs it and
// notifies listeners — it doesn't reduce it into any in-memory state.
locationsRoutes.put('/v1/locations', async (c) => {
  const auth = await getAuthFromContext(c);
  if (!auth) return c.json({ status: 'not authenticated' }, 401);
  const location = await c.req.json<Location>();

  const mongo = await mongoPromise;
  await mongo.db().collection<Location>(LOCATIONS_COLLECTION).replaceOne({ id: location.id }, location, { upsert: true });

  const event = { ...LocationEvents.LocationUpdated(location), id: uuid(), meta: { author: userAuthor(auth.userId, auth.name ?? auth.email), timestamp: Date.now(), commandId: uuid() } };
  await (await getServices()).stateManager.broadcastEvents([event], undefined);
  return c.json({ status: 'ok' });
});

locationsRoutes.delete('/v1/locations/:id', async (c) => {
  const auth = await getAuthFromContext(c);
  if (!auth) return c.json({ status: 'not authenticated' }, 401);
  const id = c.req.param('id');

  const mongo = await mongoPromise;
  await mongo.db().collection<Location>(LOCATIONS_COLLECTION).deleteOne({ id });

  const event = { ...LocationEvents.LocationRemoved(id), id: uuid(), meta: { author: userAuthor(auth.userId, auth.name ?? auth.email), timestamp: Date.now(), commandId: uuid() } };
  await (await getServices()).stateManager.broadcastEvents([event], undefined);
  return c.json({ status: 'ok' });
});
