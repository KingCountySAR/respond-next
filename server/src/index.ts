import { readFileSync } from 'fs';
import { resolve } from 'path';

import { BootData } from '@app/shared';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Context, Hono } from 'hono';
import { logger } from 'hono/logger';

import './config.js';
import { connectDb } from './db/mongo.js';
import { domainFromRequest } from './lib/request.js';
import { getUserFromSession } from './lib/session.js';
import { setupActivityRoutes } from './routes/api/activitiesApi.js';
import { setupEnvironmentApi } from './routes/api/environmentApi.js';
import { setupApiRoutes } from './routes/api/index.js';
import { setupLocationRoutes } from './routes/api/locationsApi.js';
import { setupAuthRoutes } from './routes/auth.js';
import { eventsRoutes } from './routes/events.js';
import { OrganizationService } from './svc/organizationService.js';

// In production, the client build output is expected at ../../client/dist
// relative to the compiled server — adjust if your build layout differs
const CLIENT_DIST = resolve(process.cwd(), './static');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID missing from config');
}

const orgService = new OrganizationService();

async function getBootDataForRequest(c: Context): Promise<BootData> {
  const domain = domainFromRequest(c);

  const data: BootData = {
    googleClientId: GOOGLE_CLIENT_ID!,
    environment: await orgService.getEnvironmentForDomain(domain),
  };
  const sessionLogin = await getUserFromSession(c);
  if (sessionLogin) {
    const { id, ...clientParts } = sessionLogin;
    data.login = clientParts;
  }
  return data;
}


const app = new Hono();

// Middleware
app.use('*', logger());

// Routes
app.route('/api/auth', setupAuthRoutes(orgService));
app.route('/events', eventsRoutes);
app.route('/api', setupApiRoutes(orgService));
app.route('/api', setupEnvironmentApi(getBootDataForRequest));
app.route('/api', setupLocationRoutes());
app.route('/api', setupActivityRoutes());
app.get('/api', (c) => c.json({ error: 'Not found' }, 404));

// Health check
app.get('/health', (c) => c.json({ ok: true }));

const indexHandler = async (c: Context) => {
  const accept = c.req.header('Accept') ?? '';
  if (accept.length > 0 && !accept.includes('text/html')) {
    return c.text('not found', 404);
  }

  const data = await getBootDataForRequest(c);
  const script = `<script>window.environmentBootConfig = ${JSON.stringify(data).replace(/</g, '\\u003c')};</script>`;

  let html = readFileSync(resolve(CLIENT_DIST, 'index.html'), 'utf-8');
  html = html.replace('<!-- BOOT_DATA -->', script);
  return c.html(html);
};

app.get('/', indexHandler);

// Static assets (JS/CSS/images from Vite build)
app.use('*', serveStatic({ root: CLIENT_DIST, onFound: (_path, c) => {
  c.header('Cache-Control', 'public, immutable, max-age=60400'); // Cache for 1 week
} }));

// SPA fallback — any unmatched route serves index.html so React Router can handle it
app.get('*', indexHandler);

// Boot
const PORT = Number(process.env.PORT ?? 3000);

connectDb().then(() => {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});

// Export the app type for Hono RPC — import this in the client for end-to-end types
export type AppType = typeof app;
