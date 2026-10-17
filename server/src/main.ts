import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { ACTIVITY_LIST_ID, activityProjector, activityRegistry, type SiteConfig } from '@sync/domain';
import { Hub, MemoryStorage, PostgresStorage, type ActivityStorage } from '@sync/server';
import { createSyncApp } from './app';
import { SummaryWriter } from './summaries';

// 4000 is the one origin the browser sees (and the OAuth redirect target). In `npm run dev`
// this server runs on 5174 behind Vite's proxy; the production bundle serves the UI itself.
const port = Number(process.env.PORT ?? 4000);
// The build bundles with NODE_ENV=production; under tsx it comes from the environment.
const production = process.env.NODE_ENV === 'production';

async function openStorage(): Promise<{ storage: ActivityStorage; label: string; close(): Promise<void> }> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (production) console.warn('DATABASE_URL is not set: using in-memory storage; everything is lost on restart');
    return { storage: new MemoryStorage(), label: 'memory', close: async () => {} };
  }
  try {
    const postgres = await PostgresStorage.connect(url);
    return { storage: postgres, label: `postgres ${new URL(url).host}`, close: () => postgres.close() };
  } catch (err) {
    console.error(`Cannot reach Postgres at ${new URL(url).host}. In development, start it with \`npm run db\`.`);
    throw err;
  }
}

const { storage, label: storageLabel, close: closeStorage } = await openStorage();

/** The built UI: UI_DIST if set, else `public/` next to the server bundle. */
function uiDir(): string | undefined {
  const dir = process.env.UI_DIST ?? fileURLToPath(new URL('./public', import.meta.url));
  // serveStatic resolves `root` against the working directory.
  return existsSync(dir) ? relative(process.cwd(), dir) || '.' : undefined;
}

const summaries = new SummaryWriter(() => hub);
const hub: Hub = new Hub({
  storage,
  registry: activityRegistry,
  projector: activityProjector,
  now: Date.now,
  onCommit: summaries.onCommit,
  // Only the server writes the activity list.
  readOnly: (activityId) => activityId === ACTIVITY_LIST_ID,
  log: process.env.SYNC_LOG ? (dir, connId, msg) => console.log(dir === 'in' ? '<-' : '->', connId.slice(0, 8), JSON.stringify(msg)) : undefined,
});

const backfilled = await summaries.backfill(storage);
if (backfilled) console.log(`added list summaries for ${backfilled} activities`);

/** Until organizations are stored, the site comes from the environment, with the legacy app's defaults. */
const site: SiteConfig = {
  organization: {
    id: process.env.ORG_ID ?? 'org-team',
    title: process.env.ORG_TITLE ?? 'Team',
    shortTitle: process.env.ORG_SHORT_TITLE ?? process.env.ORG_TITLE ?? 'Team',
  },
  theme: { primary: process.env.THEME_PRIMARY ?? 'rgb(200, 100, 100)', primaryDark: process.env.THEME_PRIMARY_DARK },
  // No Google sign-in until phase 2: the web app offers the dev sign-in.
  dev: { noExternalNetwork: true, buildId: process.env.BUILD_ID ?? 'dev' },
};

const { app, injectWebSocket } = createSyncApp(hub, {
  site,
  debugActivity: production
    ? undefined
    : async (activityId, view) => {
        const actor = await hub.actor(activityId);
        return {
          version: actor.currentVersion,
          subscribers: actor.subscriberCount,
          records: actor.projectedRecords(view),
          log: await storage.recentLog(activityId, 50),
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
  console.log(`server listening on http://localhost:${info.port}; storage: ${storageLabel}${ui ? `; UI from ${ui}` : ''}${production ? '' : ' [development]'}`),
);
injectWebSocket(server);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    void closeStorage().finally(() => process.exit(0));
  });
}
