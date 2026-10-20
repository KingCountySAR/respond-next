import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { ACTIVITY_ARCHIVE_ID, ACTIVITY_LIST_ID, activityProjector, activityRegistry } from '@sync/domain';
import { Hub, MemoryStorage, PostgresStorage, type ActivityStorage } from '@sync/server';
import { createSyncApp } from './app';
import { SummaryWriter } from './summaries';
import { ActivityLogWriter } from './activityLog';
import { MemoryLocationCatalog, PostgresLocationCatalog, type LocationCatalog } from './locations';
import { MemoryGrantStore, PostgresGrantStore, type GrantStore } from './grants';
import { MemberInfoWriter } from './memberInfo';
import { MemberProviders } from './memberProviders';
import { SignInProviders } from './google';
import { OrganizationStore } from './organizations';
import { SecretBox } from './secrets';
import { MemorySessionStore, PostgresSessionStore, type SessionStore } from './sessions';
import { NoaaWeather } from './weather';

// 4000 is the one origin the browser sees (and the OAuth redirect target). In `npm run dev`
// this server runs on 5174 behind Vite's proxy; the production bundle serves the UI itself.
const port = Number(process.env.PORT ?? 4000);
// The build bundles with NODE_ENV=production; under tsx it comes from the environment.
const production = process.env.NODE_ENV === 'production';
// DEV_TOOLS=true: the dev sign-in (anyone, as anyone), session tokens on URLs and the debug route.
// Only ever set explicitly (server/.env.development does), never by the kind of build, so a
// local build that reaches the internet doesn't take them along.
const devTools = process.env.DEV_TOOLS === 'true';
if (devTools) console.warn('DEV_TOOLS is on: anyone can sign in as anyone. Never on an internet-facing site.');

// SITE_ADMINS: comma-separated emails, site admins beside those the admin page keeps.
const envAdmins = (process.env.SITE_ADMINS ?? '').split(',');
// SECRETS_KEY encrypts the secrets stored in the database (see secrets.ts).
const secrets = new SecretBox(process.env.SECRETS_KEY);
if (!secrets.ready && process.env.DATABASE_URL) console.warn('SECRETS_KEY is not set: member providers with client secrets cannot be saved or used');

interface Stores {
  storage: ActivityStorage;
  locations: LocationCatalog;
  organizations: OrganizationStore;
  sessions: SessionStore;
  grants: GrantStore;
  label: string;
  close(): Promise<void>;
}

async function openStorage(): Promise<Stores> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (production) console.warn('DATABASE_URL is not set: using in-memory storage; everything is lost on restart');
    return {
      storage: new MemoryStorage(),
      locations: new MemoryLocationCatalog(),
      organizations: OrganizationStore.memory(undefined, { envAdmins, secrets }),
      sessions: new MemorySessionStore(),
      grants: new MemoryGrantStore(),
      label: 'memory',
      close: async () => {},
    };
  }
  try {
    const postgres = await PostgresStorage.connect(url);
    const locations = await PostgresLocationCatalog.connect(url);
    const organizations = await OrganizationStore.connect(url, { envAdmins, secrets });
    const sessions = await PostgresSessionStore.connect(url);
    const grants = await PostgresGrantStore.connect(url);
    return {
      storage: postgres,
      locations,
      organizations,
      sessions,
      grants,
      label: `postgres ${new URL(url).host}`,
      close: async () => {
        await postgres.close();
        await locations.close();
        await organizations.close();
        await sessions.close();
        await grants.close();
      },
    };
  } catch (err) {
    console.error(`Cannot reach Postgres at ${new URL(url).host}. In development, start it with \`npm run db\`.`);
    throw err;
  }
}

const { storage, locations, organizations, sessions, grants, label: storageLabel, close: closeStorage } = await openStorage();
if (!organizations.all().length) console.warn('No organizations: every site answers 404. Import some with `npm run seed -- <file>`.');

/** The built UI: UI_DIST if set, else `public/` next to the server bundle. */
function uiDir(): string | undefined {
  const dir = process.env.UI_DIST ?? fileURLToPath(new URL('./public', import.meta.url));
  // serveStatic resolves `root` against the working directory.
  return existsSync(dir) ? relative(process.cwd(), dir) || '.' : undefined;
}

const members = new MemberProviders(organizations);
const summaries = new SummaryWriter(() => hub);
const memberInfo = new MemberInfoWriter(() => hub, members);
const activityLog = new ActivityLogWriter(() => hub);
const hub: Hub = new Hub({
  storage,
  registry: activityRegistry,
  projector: activityProjector,
  now: Date.now,
  onCommit: (activityId, view, changes) => {
    summaries.onCommit(activityId, view);
    memberInfo.onCommit(activityId, view);
    activityLog.onCommit(activityId, view, changes);
  },
  // Only the server writes the activity list and archive.
  readOnly: (activityId) => activityId === ACTIVITY_LIST_ID || activityId === ACTIVITY_ARCHIVE_ID,
  log: process.env.SYNC_LOG ? (dir, connId, msg) => console.log(dir === 'in' ? '<-' : '->', connId.slice(0, 8), JSON.stringify(msg)) : undefined,
});

const backfilled = await summaries.backfill(storage);
if (backfilled) console.log(`added summaries for ${backfilled} activities`);

// Activities no one has open leave memory after a few minutes; closed ones leave the list after
// ACTIVITY_LIST_HISTORY_DAYS.
setInterval(() => void hub.unloadIdle().catch((err) => console.error('sync: unloading idle activities failed', err)), 60_000).unref();
setInterval(() => void summaries.prune().catch((err) => console.error('sync: pruning the activity list failed', err)), 60 * 60_000).unref();

const { app, injectWebSocket } = createSyncApp(hub, {
  organizations,
  sessions,
  devSignIn: devTools,
  // Each site signs in through its organization's sign-in provider (or its nearest ancestor's).
  signIn: new SignInProviders(organizations),
  signInCallback: process.env.SIGN_IN_CALLBACK || undefined,
  secureCookies: production,
  buildId: process.env.BUILD_ID,
  members,
  grants,
  locations,
  weather: new NoaaWeather(),
  debugActivity: !devTools
    ? undefined
    : async (activityId, view) => {
        const actor = await hub.actor(activityId);
        return {
          version: actor.currentVersion,
          subscribers: actor.subscriberCount,
          loaded: hub.loadedCount,
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
  console.log(`server listening on http://localhost:${info.port}; storage: ${storageLabel}${ui ? `; UI from ${ui}` : ''}${devTools ? ' [DEV_TOOLS]' : ''}`),
);
injectWebSocket(server);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    void closeStorage().finally(() => process.exit(0));
  });
}
