import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { randomId } from '@sync/core';
import { activityProjector, activityRegistry, type SavedLocation, type SiteConfig } from '@sync/domain';
import { Hub, MemoryStorage } from '@sync/server';
import { createSyncApp } from '../src/app';
import { MemoryLocationCatalog, PostgresLocationCatalog, type LocationCatalog } from '../src/locations';

/** The Postgres suite runs when TEST_DATABASE_URL (default: the `npm run db` container) is reachable. */
const POSTGRES_BASE = process.env.TEST_DATABASE_URL ?? 'postgres://sync:sync@localhost:5433/sync';

async function admin(sql: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: POSTGRES_BASE, connectionTimeoutMillis: 1500 });
  try {
    await client.connect();
  } catch {
    return false;
  }
  try {
    await client.query(sql);
    return true;
  } finally {
    await client.end();
  }
}

type Backend = () => Promise<{ catalog: LocationCatalog; cleanup(): Promise<void> }>;
const backends: [string, Backend][] = [['memory', async () => ({ catalog: new MemoryLocationCatalog(), cleanup: async () => {} })]];
if (await admin('SELECT 1')) {
  backends.push([
    'postgres',
    async () => {
      const name = `sync_test_${randomId().slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      await admin(`CREATE DATABASE ${name}`);
      const url = new URL(POSTGRES_BASE);
      url.pathname = `/${name}`;
      const catalog = await PostgresLocationCatalog.connect(url.toString());
      return {
        catalog,
        async cleanup() {
          await catalog.close();
          await admin(`DROP DATABASE ${name} WITH (FORCE)`);
        },
      };
    },
  ]);
}

const loc = (id: string, title: string, fields: Partial<SavedLocation> = {}): SavedLocation => ({ id, title, lat: null, lon: null, address: null, description: '', ...fields });

describe.each(backends)('%s location catalog', (_name, makeBackend) => {
  let catalog: LocationCatalog;
  let cleanup: () => Promise<void>;
  beforeEach(async () => {
    ({ catalog, cleanup } = await makeBackend());
  });
  afterEach(async () => {
    await cleanup();
  });

  it('searches by title, case-insensitive, sorted; all for an empty query', async () => {
    await catalog.put(loc('2', 'Tiger Mountain'));
    await catalog.put(loc('1', 'Mailbox Peak Trailhead', { lat: 47.4672, lon: -121.6754 }));
    await catalog.put(loc('3', 'Mount Si'));
    expect((await catalog.search('')).map((l) => l.title)).toEqual(['Mailbox Peak Trailhead', 'Mount Si', 'Tiger Mountain']);
    expect((await catalog.search(' MOUNT ')).map((l) => l.id)).toEqual(['3', '2']);
    expect((await catalog.search('mailbox'))[0]).toEqual(loc('1', 'Mailbox Peak Trailhead', { lat: 47.4672, lon: -121.6754 }));
  });

  it('replaces by id, and removes', async () => {
    await catalog.put(loc('1', 'Mailbox Peak'));
    await catalog.put(loc('1', 'Mailbox Peak Trailhead', { description: 'Upper lot' }));
    expect(await catalog.search('')).toEqual([loc('1', 'Mailbox Peak Trailhead', { description: 'Upper lot' })]);
    await catalog.remove('1');
    await catalog.remove('missing');
    expect(await catalog.search('')).toEqual([]);
  });
});

describe('location routes', () => {
  const site: SiteConfig = {
    organization: { id: 'org-crt', title: 'Cascade Rescue Team', shortTitle: 'CRT', canCreateMissions: true, canCreateEvents: true, partners: [] },
    theme: { primary: '#336' },
    dev: { noExternalNetwork: true, buildId: 'test' },
  };
  const catalog = new MemoryLocationCatalog();
  const { app } = createSyncApp(new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: Date.now }), { site, locations: catalog });
  const put = (body: unknown) => app.request('/api/v1/locations', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('saves, searches and deletes', async () => {
    expect((await put(loc('1', 'Mount Si'))).status).toBe(200);
    const res = await app.request('/api/v1/locations?query=si');
    expect(((await res.json()) as { data: SavedLocation[] }).data).toEqual([loc('1', 'Mount Si')]);
    expect((await app.request('/api/v1/locations/1', { method: 'DELETE' })).status).toBe(200);
    expect(await catalog.search('')).toEqual([]);
  });

  it('refuses a location without a title, naming the field', async () => {
    const res = await put({ id: 'x', title: ' ', lat: null, lon: null, address: null, description: '' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/^title: /);
  });
});
