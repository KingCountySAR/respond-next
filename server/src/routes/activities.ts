import { Hono } from 'hono';

import type { ActivityType } from '@shared/types/activity';

import { getAuthFromContext, userFromAuth } from '../auth';
import { getServices } from '../services';

export const activitiesRoutes = new Hono();

async function activitiesList(activityType: ActivityType) {
  const list = (await (await getServices()).stateManager.getAllActivities())
    .filter((a) => a.isMission === (activityType === 'missions'))
    .sort((a, b) => (a.startTime > b.startTime ? 1 : a.startTime < b.startTime ? -1 : 0));
  return { status: 'ok', data: list };
}

activitiesRoutes.get('/v1/missions', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  return c.json(await activitiesList('missions'));
});

activitiesRoutes.get('/v1/events', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  return c.json(await activitiesList('events'));
});

activitiesRoutes.get('/v1/activities/:activityId', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  const activity = (await (await getServices()).stateManager.getAllActivities()).find((a) => a.id === c.req.param('activityId'));
  if (!activity) return c.json({ status: 'not found' }, 404);
  return c.json({ status: 'ok', data: activity });
});
