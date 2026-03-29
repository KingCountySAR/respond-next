import { ACTIVITIES_COLLECTION, ActivityDoc } from '@server/db/index.js';
import { getDb } from '@server/db/mongo.js';
import { AuthVariables, withApiLogin } from '@server/middleware/auth.js';
import { Hono } from 'hono';

export function setupActivityRoutes() {
  const apiRoutes = new Hono<{ Variables: AuthVariables }>();

  apiRoutes.get('/activity/:activityId', withApiLogin, async (c) => {
    const { activityId } = c.req.param();
    const doc = await getDb().collection<ActivityDoc>(ACTIVITIES_COLLECTION).findOne({ id: activityId, removeTime: undefined });
    if (!doc) {
      return c.json('not found', 404);
    }

    const { _id, removeTime, ...result } = doc;
    console.log(result);
    return c.json({ result });
  });

  return apiRoutes;
}
