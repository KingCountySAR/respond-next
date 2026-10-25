import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { ACCESS_CHANGED, encode, randomId, type ClientMessage, type ServerMessage } from '@sync/core';
import { SYSTEM_VIEWER, TierRules, type ActivityViewer, type GrantResponse } from '@sync/domain';
import type { Hub } from '@sync/server';
import { PostgresGrantStore } from '../src/grants';
import { PostgresSessionStore } from '../src/sessions';
import { DevSignInRequest } from '../src/signIn';
import { CRT, activityArgs } from '../../packages/domain/__tests__/helpers';
import { testApp } from './helpers';

const BO = 'kcsara:3';
const grantPath = (personRef = BO, activityId = 'a1') => `/api/activities/${activityId}/grants/${personRef}`;
const grant = (tier = 'manage') => ({ method: 'PUT', body: { tier } });
const settle = () => new Promise((r) => setTimeout(r, 20));

/** A connection to the hub, as the WebSocket makes for a session: what it's sent, and whether it was closed. */
function connect(hub: Hub, viewer: ActivityViewer, activities: (string | { activityId: string; since: number; view?: string })[]) {
  const received: ServerMessage[] = [];
  const closed: number[] = [];
  const handlers = hub.connect({ viewer, send: (text) => received.push(JSON.parse(text) as ServerMessage), close: (code) => closed.push(code) });
  const send = (msg: ClientMessage) => handlers.message(encode(msg));
  send({ t: 'hello', clientId: randomId(), build: 'test', subs: activities.map((a) => (typeof a === 'string' ? { activityId: a, since: 0 } : a)) });
  let nextId = 1;
  return {
    received,
    closed,
    push: (activityId: string, name: string, args: Record<string, unknown>) => send({ t: 'push', activityId, mutations: [{ id: nextId++, name, v: 1, args, clientTime: Date.now() }] }),
    rejects: () => received.flatMap((m) => (m.t === 'reject' ? [m.reason] : [])),
    /** The view key of the latest reset for an activity. */
    view: (activityId: string) => received.flatMap((m) => (m.t === 'reset' && m.activityId === activityId ? [m.view] : [])).at(-1),
  };
}

const memberViewer = (personRef: string): ActivityViewer => ({ userId: personRef, tier: 'respond', class: 'member', personRef });

/** A server with missions Bo is on, and Avery signed in as a manager. */
async function setup() {
  const app = testApp();
  for (const id of ['a1', 'a2']) {
    const push = (name: string, args: Record<string, unknown>) => app.hub.pushAsSystem(id, SYSTEM_VIEWER, [{ name, args: { at: Date.now(), ...args } }]);
    await push('createActivity', activityArgs({ startTime: Date.now() }));
    await push('addParticipant', { personRef: BO, firstname: 'Bo', lastname: 'Okafor', unit: CRT, status: 'responding' });
  }
  const avery = app.client();
  await avery.signIn('avery.lindqvist@crt.example.org', { tier: 'manage' });
  return { ...app, avery };
}

describe('tier grants', () => {
  it('let someone on the roster manage that mission only, at once', async () => {
    const { avery, client, hub } = await setup();
    const bo = client();
    await bo.signIn('bo.okafor@crt.example.org', { tier: undefined });
    const connection = connect(hub, memberViewer(BO), ['a1']);
    expect((await bo.request(grantPath())).status).toBe(403);

    const given = await avery.json<GrantResponse>(grantPath(), grant());
    expect(given.status).toBe(200);
    expect(given.body.grant).toMatchObject({ tier: 'manage', grantedBy: 'avery.lindqvist@crt.example.org' });
    expect((await avery.json<GrantResponse>(grantPath())).body.grant?.tier).toBe('manage');
    expect((await avery.json<GrantResponse>(grantPath(BO, 'a2'))).body.grant).toBeNull();
    // Their connection is closed, to reconnect as who they are now, and their session is up to date:
    // managing a1 (so they may grant there), not a2, without signing in again.
    expect(connection.closed).toEqual([ACCESS_CHANGED]);
    expect((await bo.request(grantPath())).status).toBe(200);
    expect((await bo.request(grantPath(BO, 'a2'))).status).toBe(403);
    expect((await bo.json<{ error: string }>(grantPath('kcsara:2'), grant())).body.error).toBe("kcsara:2 isn't on that activity's roster");
    // A new sign-in has it too.
    const again = client();
    await again.signIn('bo.okafor@crt.example.org', { tier: undefined });
    expect((await again.request(grantPath())).status).toBe(200);

    // Taken away, it's gone at once.
    expect((await avery.json<GrantResponse>(grantPath(), { method: 'DELETE' })).body.grant).toBeNull();
    expect((await bo.request(grantPath())).status).toBe(403);
  });

  it('are only for managers to give, and only to someone on the roster', async () => {
    const { avery, client } = await setup();
    const respond = client();
    await respond.signIn('kai.lindqvist@crt.example.org');
    expect((await respond.request(grantPath(), grant())).status).toBe(403);
    expect((await respond.request(grantPath())).status).toBe(403);
    expect((await avery.json<{ error: string }>(grantPath('kcsara:2'), grant())).body.error).toBe("kcsara:2 isn't on that activity's roster");
    expect((await avery.request(grantPath(BO, 'other'), grant())).status).toBe(400);
    expect((await avery.request(grantPath(), grant('respond'))).status).toBe(400);
  });
});

describe('activity kinds', () => {
  const KAI = 'kcsara:2';

  it('let members manage trainings, and missions only at their tier', async () => {
    const { hub } = testApp();
    await hub.pushAsSystem('t1', SYSTEM_VIEWER, [{ name: 'createActivity', args: activityArgs({ kind: 'training', startTime: Date.now() }) }]);
    await hub.pushAsSystem('m1', SYSTEM_VIEWER, [{ name: 'createActivity', args: activityArgs({ startTime: Date.now() }) }]);
    const kai = connect(hub, memberViewer(KAI), ['t1', 'm1']);
    await settle();
    expect([kai.view('t1'), kai.view('m1')]).toEqual(['manage', 'respond:member']);

    kai.push('t1', 'updateActivity', { title: 'Rope refresher' });
    kai.push('m1', 'updateActivity', { title: 'Not theirs' });
    await settle();
    expect(kai.rejects()).toEqual(['forbidden']);
    // But they may not make a training a mission.
    kai.push('t1', 'updateActivity', { kind: 'mission' });
    await settle();
    expect(kai.rejects()).toEqual(['forbidden', 'forbidden']);
  });

  it('close the connection of a subscriber whose view a change of kind changes, to reconnect afresh', async () => {
    const { hub } = testApp();
    await hub.pushAsSystem('t1', SYSTEM_VIEWER, [{ name: 'createActivity', args: activityArgs({ kind: 'training', startTime: Date.now() }) }]);
    const kai = connect(hub, memberViewer(KAI), ['t1']);
    await settle();
    expect(kai.view('t1')).toBe('manage');
    await hub.pushAsSystem('t1', SYSTEM_VIEWER, [{ name: 'updateActivity', args: { kind: 'mission' } }]);
    await settle();
    expect(kai.closed).toEqual([ACCESS_CHANGED]);
    // Back, up to date but with its copy in the manage view: it starts over, as respond.
    const back = connect(hub, memberViewer(KAI), [{ activityId: 't1', since: 2, view: 'manage' }]);
    await settle();
    expect(back.view('t1')).toBe('respond:member');
    // Up to date and in the same view: no need.
    const same = connect(hub, memberViewer(KAI), [{ activityId: 't1', since: 2, view: 'respond:member' }]);
    await settle();
    expect(same.received.map((m) => m.t)).toEqual(['update']);
  });

  it('let members create trainings, but not missions', async () => {
    const { hub } = testApp();
    const mission = connect(hub, memberViewer(KAI), ['m2']);
    await settle();
    mission.push('m2', 'createActivity', activityArgs({ startTime: Date.now() }));
    await settle();
    expect(mission.rejects()).toEqual(['forbidden']);
    // Making a training lets them manage it: they reconnect, to get it as a manager.
    const training = connect(hub, memberViewer(KAI), ['t2']);
    await settle();
    training.push('t2', 'createActivity', activityArgs({ kind: 'training', startTime: Date.now() }));
    await settle();
    expect(training.rejects()).toEqual([]);
    expect((await hub.actor('t2')).currentVersion).toBe(1);
    expect(training.closed).toEqual([ACCESS_CHANGED]);
    // Visitors may not.
    const visitor = connect(hub, { userId: 'adhoc:x@example.org', tier: 'respond', class: 'external', personRef: 'adhoc:x@example.org' }, ['t3']);
    await settle();
    visitor.push('t3', 'createActivity', activityArgs({ kind: 'training', startTime: Date.now() }));
    await settle();
    expect(visitor.rejects()).toEqual(['forbidden']);
  });
});

const POSTGRES_BASE = process.env.TEST_DATABASE_URL ?? 'postgres://sync:sync@localhost:5433/sync';
async function admin(sql: string): Promise<boolean> {
  const c = new pg.Client({ connectionString: POSTGRES_BASE, connectionTimeoutMillis: 1500 });
  try {
    await c.connect();
  } catch {
    return false;
  }
  try {
    await c.query(sql);
    return true;
  } finally {
    await c.end();
  }
}
const hasPostgres = await admin('SELECT 1');

describe('postgres grant store', () => {
  it.runIf(hasPostgres)('keeps grants, per activity, across connections', async () => {
    const name = `sync_test_${randomId().slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    await admin(`CREATE DATABASE ${name}`);
    const url = new URL(POSTGRES_BASE);
    url.pathname = `/${name}`;
    try {
      const first = await PostgresGrantStore.connect(url.toString());
      await first.set(BO, 'a1', { tier: 'manage', grantedBy: 'a@example.org', grantedAt: 1000 });
      await first.set(BO, 'a1', { tier: 'manage', grantedBy: 'b@example.org', grantedAt: 2000 });
      await first.set(BO, 'a2', { tier: 'manage', grantedBy: 'b@example.org', grantedAt: 3000 });
      await first.close();
      const second = await PostgresGrantStore.connect(url.toString());
      expect(await second.get(BO, 'a1')).toEqual({ tier: 'manage', grantedBy: 'b@example.org', grantedAt: 2000 });
      expect(await second.forPerson(BO)).toEqual({ a1: 'manage', a2: 'manage' });
      await second.remove(BO, 'a1');
      expect(await second.get(BO, 'a1')).toBeUndefined();
      expect(await second.forPerson(BO)).toEqual({ a2: 'manage' });
      await second.close();
    } finally {
      await admin(`DROP DATABASE ${name} WITH (FORCE)`);
    }
  });
});

describe("the tiers' former names", () => {
  it('are read as today’s: command and support as manage, field as respond', () => {
    expect(TierRules.parse({ 'ESAR OL': 'command', 'ESAR Comms': 'support', Others: 'field', New: 'manage' })).toEqual({ 'ESAR OL': 'manage', 'ESAR Comms': 'manage', Others: 'respond', New: 'manage' });
    expect(DevSignInRequest.parse({ email: 'bo.okafor@crt.example.org', tier: 'command', class: 'member' }).tier).toBe('manage');
    expect(() => TierRules.parse({ X: 'boss' })).toThrow();
  });

  it.runIf(hasPostgres)('are brought up to date in stored grants and sessions', async () => {
    const name = `sync_test_${randomId().slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    await admin(`CREATE DATABASE ${name}`);
    const url = new URL(POSTGRES_BASE);
    url.pathname = `/${name}`;
    try {
      await (await PostgresGrantStore.connect(url.toString())).close();
      const sessions = await PostgresSessionStore.connect(url.toString());
      const db = new pg.Client({ connectionString: url.toString() });
      await db.connect();
      await db.query(`INSERT INTO activity_grants VALUES ('${BO}', 'a1', 'command', 'a@example.org', now()), ('${BO}', 'a2', 'support', 'a@example.org', now())`);
      const id = await sessions.create({ userId: BO, name: 'Bo Okafor', email: 'bo@example.org', personRef: BO, tier: 'field' as never, class: 'member', orgId: 'crt', grants: { a1: 'command' as never } });
      await db.end();

      const grants = await PostgresGrantStore.connect(url.toString());
      expect(await grants.forPerson(BO)).toEqual({ a1: 'manage', a2: 'manage' });
      await grants.close();
      expect(await sessions.get(id)).toMatchObject({ tier: 'respond', grants: { a1: 'manage' } });
      await sessions.close();
    } finally {
      await admin(`DROP DATABASE ${name} WITH (FORCE)`);
    }
  });
});
