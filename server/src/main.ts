import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { toyProjector, toyRegistry } from '@sync/toy-domain';
import { Hub, MemoryStorage } from '@sync/server';
import { createSyncApp } from './app';

// 4000 is the one origin the browser sees (and the OAuth redirect target). In `npm run dev`
// this server runs on 5174 behind Vite's proxy; the production bundle serves the UI itself.
const port = Number(process.env.PORT ?? 4000);
// The build bundles with NODE_ENV=production; under tsx it comes from the environment.
const production = process.env.NODE_ENV === 'production';
const storage = new MemoryStorage();

/** The built UI: UI_DIST if set, else `public/` next to the server bundle. */
function uiDir(): string | undefined {
  const dir = process.env.UI_DIST ?? fileURLToPath(new URL('./public', import.meta.url));
  // serveStatic resolves `root` against the working directory.
  return existsSync(dir) ? relative(process.cwd(), dir) || '.' : undefined;
}

const hub = new Hub({
  storage,
  registry: toyRegistry,
  projector: toyProjector,
  now: Date.now,
  log: process.env.SYNC_LOG ? (dir, connId, msg) => console.log(dir === 'in' ? '<-' : '->', connId.slice(0, 8), JSON.stringify(msg)) : undefined,
});

const { app, injectWebSocket } = createSyncApp(hub, {
  debugEvent: production
    ? undefined
    : async (eventId, view) => {
        const actor = await hub.actor(eventId);
        return {
          version: actor.currentVersion,
          subscribers: actor.subscriberCount,
          records: actor.projectedRecords(view),
          log: storage.log.filter((e) => e.eventId === eventId).slice(-50),
        };
      },
});

const ui = uiDir();
if (ui) {
  app.use('/*', serveStatic({ root: ui }));
  // SPA fallback: client-side routes get index.html.
  app.get('*', serveStatic({ path: `${ui}/index.html` }));
}

const server = serve({ fetch: app.fetch, port }, (info) =>
  console.log(`server listening on http://localhost:${info.port}${ui ? ` (UI from ${ui})` : ''}${production ? '' : ' [development]'}`),
);
injectWebSocket(server);
