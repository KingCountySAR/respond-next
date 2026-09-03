import { Hono } from 'hono';

import { activitiesRoutes } from './activities';
import { authRoutes } from './auth';
import { bootstrapRoutes } from './bootstrap';
import { locationsRoutes } from './locations';
import { organizationsRoutes } from './organizations';
import { pwaRoutes } from './pwa';
import { weatherRoutes } from './weather';

export const api = new Hono();

api.route('/', activitiesRoutes);
api.route('/', locationsRoutes);
api.route('/', organizationsRoutes);
api.route('/', pwaRoutes);
api.route('/', bootstrapRoutes);
api.route('/', authRoutes);
api.route('/', weatherRoutes);
