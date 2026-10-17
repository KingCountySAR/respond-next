import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { encode, randomId, type ClientMessage, type Rec, type ServerMessage } from '@sync/core';
import { Hub, MemoryStorage, PostgresStorage, StorageConflictError, type ActivityStorage, type HubConnection, type LogEntry } from '@sync/server';
import { toyProjector, toyRegistry } from '@sync/toy-domain';

/**
 * The same contract for every ActivityStorage. The Postgres suite runs when TEST_DATABASE_URL
 * (default: the `npm run db` container) is reachable, each test in a throwaway database.
 */
const POSTGRES_BASE = process.env.TEST_DATABASE_URL ?? 'postgres://sync:sync@localhost:5433/sync';

/** Runs one statement on the base database; null if Postgres isn't reachable. */
async function admin<T>(sql: string): Promise<T[] | null> {
  const client = new pg.Client({ connectionString: POSTGRES_BASE, connectionTimeoutMillis: 1500 });
  try {
    await client.connect();
  } catch {
    return null;
  }
  try {
    return (await client.query(sql)).rows as T[];
  } finally {
    await client.end();
  }
}

type Backend = () => Promise<{ storage: ActivityStorage; cleanup(): Promise<void> }>;

const backends: [string, Backend][] = [['memory', async () => ({ storage: new MemoryStorage(), cleanup: async () => {} })]];
if ((await admin('SELECT 1')) !== null) {
  backends.push([
    'postgres',
    async () => {
      const name = `sync_test_${randomId().slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      await admin(`CREATE DATABASE ${name}`);
      const url = new URL(POSTGRES_BASE);
      url.pathname = `/${name}`;
      const storage = await PostgresStorage.connect(url.toString());
      return {
        storage,
        async cleanup() {
          await storage.close();
          await admin(`DROP DATABASE ${name} WITH (FORCE)`);
        },
      };
    },
  ]);
} else {
  console.warn(`storage.test: Postgres not reachable at ${new URL(POSTGRES_BASE).host}; skipping the Postgres suite (start it with \`npm run db\`)`);
}

const rec = (type: string, id: string, version: number, fields: Record<string, unknown> = {}): Rec => ({ type, id, version, ...fields });

const logEntry = (mutationId: number, version: number, outcome: LogEntry['outcome'] = 'applied'): LogEntry => ({
  activityId: 'e1',
  version,
  mutationId,
  clientId: 'client-a',
  userId: 'u1',
  name: 'addPerson',
  v: 1,
  args: { id: `p${mutationId}` },
  clientTime: 1000,
  receivedAt: 1001,
  outcome,
  effects: [],
});

/** A fake transport for driving a Hub directly. */
function fakeConnection(hub: Hub, tier = 'command') {
  const received: ServerMessage[] = [];
  const closes: number[] = [];
  const transport: HubConnection = {
    viewer: { userId: 'u1', tier },
    send: (text) => received.push(JSON.parse(text) as ServerMessage),
    close: (code) => closes.push(code),
  };
  const handlers = hub.connect(transport);
  return { received, closes, send: (msg: ClientMessage) => handlers.message(encode(msg)) };
}

async function waitFor(what: string, check: () => boolean | Promise<boolean>, ms = 5000): Promise<void> {
  const until = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const addPerson = (id: number, name: string) => ({ id, name: 'addPerson', v: 1, args: { id: `p${id}`, name }, clientTime: 0 });

describe.each(backends)('%s storage', (_name, makeBackend) => {
  let storage: ActivityStorage;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ storage, cleanup } = await makeBackend());
  });
  afterEach(async () => {
    await cleanup();
  });

  it('has nothing for an unknown activity', async () => {
    expect(await storage.load('nope')).toBeUndefined();
  });

  it('round-trips records, tombstones and the highest mutation id per client', async () => {
    await storage.commit('e1', {
      fromVersion: 0,
      version: 2,
      records: [rec('person', 'p1', 1, { name: 'Bob', note: null }), rec('person', 'p2', 2, { name: 'Anna' })],
      lastMutationIds: { 'client-a': 3 },
      log: [],
    });
    await storage.commit('e1', {
      fromVersion: 2,
      version: 3,
      records: [{ type: 'person', id: 'p2', version: 3, deleted: true }],
      lastMutationIds: { 'client-a': 2, 'client-b': 1 },
      log: [],
    });
    const loaded = await storage.load('e1');
    expect(loaded?.version).toBe(3);
    expect(loaded?.lastMutationIds).toEqual({ 'client-a': 3, 'client-b': 1 });
    const byId = Object.fromEntries((loaded?.records ?? []).map((r) => [r.id, r]));
    expect(byId.p1).toEqual(rec('person', 'p1', 1, { name: 'Bob', note: null }));
    expect(byId.p2).toEqual({ type: 'person', id: 'p2', version: 3, deleted: true });
  });

  it('refuses a commit built on a version that is no longer current', async () => {
    const batch = (fromVersion: number, version: number) => ({ fromVersion, version, records: [rec('person', `p${version}`, version)], lastMutationIds: {}, log: [] });
    await storage.commit('e1', batch(0, 1));
    await expect(storage.commit('e1', batch(0, 1))).rejects.toBeInstanceOf(StorageConflictError);
    await expect(storage.commit('e1', batch(5, 6))).rejects.toBeInstanceOf(StorageConflictError);
    // Nothing from the refused commits was written.
    const loaded = await storage.load('e1');
    expect(loaded?.version).toBe(1);
    expect(loaded?.records.map((r) => r.id)).toEqual(['p1']);
  });

  it('lets exactly one of two racing commits on the same version through', async () => {
    const batch = (fromVersion: number, id: string) => ({ fromVersion, version: fromVersion + 1, records: [rec('person', id, fromVersion + 1)], lastMutationIds: {}, log: [] });
    for (const fromVersion of [0, 1]) {
      const results = await Promise.allSettled([storage.commit('e1', batch(fromVersion, `a${fromVersion}`)), storage.commit('e1', batch(fromVersion, `b${fromVersion}`))]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = results.find((r) => r.status === 'rejected');
      expect(failed?.status === 'rejected' && failed.reason).toBeInstanceOf(StorageConflictError);
    }
    const loaded = await storage.load('e1');
    expect(loaded?.version).toBe(2);
    expect(loaded?.records).toHaveLength(2);
  });

  it('keeps the mutation log in commit order', async () => {
    await storage.commit('e1', { fromVersion: 0, version: 1, records: [], lastMutationIds: {}, log: [logEntry(1, 1), logEntry(2, 1, 'rejected')] });
    await storage.commit('e1', { fromVersion: 1, version: 2, records: [], lastMutationIds: {}, log: [logEntry(3, 2)] });
    expect((await storage.recentLog('e1', 10)).map((e) => [e.mutationId, e.outcome])).toEqual([
      [1, 'applied'],
      [2, 'rejected'],
      [3, 'applied'],
    ]);
    expect((await storage.recentLog('e1', 2)).map((e) => e.mutationId)).toEqual([2, 3]);
  });

  it('lets a new server process pick up an activity where the last one left off', async () => {
    const before = new Hub({ storage, registry: toyRegistry, projector: toyProjector, now: Date.now });
    const conn = fakeConnection(before);
    conn.send({ t: 'hello', clientId: 'client-a', build: 'test', subs: [{ activityId: 'e1', since: 0 }] });
    conn.send({ t: 'push', activityId: 'e1', mutations: [addPerson(1, 'Bob'), addPerson(2, 'Anna')] });
    await waitFor('both mutations confirmed', () => conn.received.some((m) => m.t === 'update' && m.lastMutationId === 2));
    const original = await before.actor('e1');

    const after = new Hub({ storage, registry: toyRegistry, projector: toyProjector, now: Date.now });
    const reloaded = await after.actor('e1');
    expect(reloaded.currentVersion).toBe(original.currentVersion);
    expect(reloaded.projectedRecords('command')).toEqual(original.projectedRecords('command'));

    // The reloaded server remembers which mutations it has seen: a resend is ignored.
    const again = fakeConnection(after);
    again.send({ t: 'hello', clientId: 'client-a', build: 'test', subs: [{ activityId: 'e1', since: original.currentVersion }] });
    again.send({ t: 'push', activityId: 'e1', mutations: [addPerson(2, 'Anna')] });
    again.send({ t: 'push', activityId: 'e1', mutations: [addPerson(3, 'Cole')] });
    await waitFor('the new mutation confirmed', () => again.received.some((m) => m.t === 'update' && m.lastMutationId === 3));
    expect(reloaded.currentVersion).toBe(original.currentVersion + 1);
    expect(again.received.filter((m) => m.t === 'reject')).toEqual([]);
  });

  it('retires an actor whose activity another process wrote, and reloads it', async () => {
    // Two server processes that both think they own e1: a lease failure, or a split during failover.
    const hubA = new Hub({ storage, registry: toyRegistry, projector: toyProjector, now: Date.now });
    const hubB = new Hub({ storage, registry: toyRegistry, projector: toyProjector, now: Date.now });
    const a = fakeConnection(hubA);
    const b = fakeConnection(hubB);
    a.send({ t: 'hello', clientId: 'client-a', build: 'test', subs: [{ activityId: 'e1', since: 0 }] });
    b.send({ t: 'hello', clientId: 'client-b', build: 'test', subs: [{ activityId: 'e1', since: 0 }] });
    await waitFor('both subscribed', () => a.received.length > 0 && b.received.length > 0);

    a.send({ t: 'push', activityId: 'e1', mutations: [addPerson(1, 'Bob')] });
    await waitFor('A committed', () => a.received.some((m) => m.t === 'update' && m.lastMutationId === 1));
    b.send({ t: 'push', activityId: 'e1', mutations: [addPerson(1, 'Anna')] });
    await waitFor("B's connection closed", () => b.closes.length > 0);
    expect(b.closes).toEqual([1012]);

    // B's next use of e1 loads the stored state, which includes A's change.
    const fresh = await hubB.actor('e1');
    expect(fresh.stale).toBe(false);
    expect(fresh.projectedRecords('command').map((r) => r.name)).toEqual(['Bob']);
    expect((await storage.load('e1'))?.version).toBe(1);
  });
});
