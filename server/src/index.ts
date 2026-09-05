import './env'; // must be first: populate process.env before mongodb.ts reads it

import type { Server as HTTPServer } from 'http';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

import { api } from './routes';
import { getServices } from './services';
import { SocketServer } from './socketManager';

const PORT = Number(process.env.PORT ?? 3000);
// Serve the built client from ./static NEXT TO this bundle (dist/static), resolved
// relative to the bundle file rather than cwd. This lets the app be launched from a
// parent dir — where the operator's .env.local lives and where env.ts reads it from
// cwd — while the replaceable client assets ship inside dist/. In dev this points at
// a nonexistent server/src/static, but the static handler below is prod-only anyway.
const CLIENT_DIST = resolve(dirname(fileURLToPath(import.meta.url)), 'static');

async function main() {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/api', api);

  // In production, serve the built client SPA from this same process (single
  // origin for static assets + API + websocket). In dev, Vite serves the client
  // and proxies /api + /socket.io here. CLIENT_DIST is next to the bundle (see above).
  if (process.env.NODE_ENV !== 'development') {
    const root = CLIENT_DIST;
    // precompressed: serve foo.js.gz (emitted by Vite at build time) when the
    // client sends Accept-Encoding: gzip; falls back to the plain file otherwise.
    app.use('/*', serveStatic({ root, precompressed: true }));
    app.get('*', serveStatic({ path: 'index.html', root, precompressed: true })); // SPA fallback
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
