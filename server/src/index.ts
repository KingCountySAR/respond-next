import './env'; // must be first: populate process.env before mongodb.ts reads it

import type { Server as HTTPServer } from 'http';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

import { api } from './routes';
import { getServices } from './services';
import { SocketServer } from './socketManager';
import { resolve } from 'path';

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIST = resolve(process.cwd(), './static')

async function main() {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/api', api);

  // In production, serve the built client SPA from this same process (single
  // origin for static assets + API + websocket). In dev, Vite serves the client
  // and proxies /api + /socket.io here. CLIENT_DIST is relative to cwd.
  if (process.env.NODE_ENV !== 'development') {
    const root = CLIENT_DIST;
    app.use('/*', serveStatic({ root }));
    app.get('*', serveStatic({ path: 'index.html', root })); // SPA fallback
  }

  // Constructing services also runs StateManager.start(), which loads current
  // activities/locations/organizations from MongoDB into memory.
  const services = await getServices();

  const httpServer = serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`respond server listening on http://localhost:${info.port}`);
  });

  // Attach socket.io to the same Node HTTP server the Hono app is served from.
  const io = new SocketServer(httpServer as unknown as HTTPServer, {
    cors: { origin: true, credentials: true },
  });
  await services.socketManager.attach(io);
}

main().catch((err) => {
  console.error('failed to start respond server', err);
  process.exit(1);
});
