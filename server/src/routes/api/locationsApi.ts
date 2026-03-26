import { Location } from '@app/shared';
import { LocationDoc, LOCATIONS_COLLECTION } from '@server/db/locationDoc.js';
import { getDb } from '@server/db/mongo.js';
import { AuthVariables, withApiLogin } from '@server/middleware/auth.js';
import { Hono } from 'hono';

export function setupLocationRoutes() {
  const apiRoutes = new Hono<{ Variables: AuthVariables }>();

  /** List locations */
  apiRoutes.get('/locations', withApiLogin, async (c) => {
    const docs = await getDb().collection<LocationDoc>(LOCATIONS_COLLECTION).find().toArray();
    const result: Location[] = docs.map(doc => {
      const { _id, ...api } = doc;
      api.isSaved = true;
      return api;
    });
    return c.json({ result });
  });

  /** Save new/existing location */
  apiRoutes.post('/locations/:locationId', withApiLogin, async (c) => {
    const { locationId } = c.req.param();
    const location = await c.req.json();
    if (location.id !== locationId) {
      return c.json({ error: 'id doesnt match' }, 400);
    }
    await getDb().collection<LocationDoc>(LOCATIONS_COLLECTION).replaceOne({ id: locationId }, location, {
      upsert: true,
    });
    return c.json(location);
  });

  /** Remove location */
  apiRoutes.delete('/locations/:locationId', withApiLogin, async (c) => {
    const { locationId } = c.req.param();
    await getDb().collection<LocationDoc>(LOCATIONS_COLLECTION).deleteOne({ id: locationId });
    return c.json({});
  });

  return apiRoutes;
}
