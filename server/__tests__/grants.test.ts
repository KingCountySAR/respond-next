import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { ACCESS_CHANGED, encode, randomId, type ClientMessage, type ServerMessage } from '@sync/core';
import { SYSTEM_VIEWER, type ActivityViewer, type GrantResponse } from '@sync/domain';
import type { Hub } from '@sync/server';
import { PostgresGrantStore } from '../src/grants';
import { CRT, activityArgs } from '../../packages/domain/__tests__/helpers';
import { testApp } from './helpers';

const BO = 'kcsara:3';
const grantPath = (personRef = BO, activityId = 'a1') => `/api/activities/${activityId}/grants/${personRef}`;
const grant = (tier = 'command') => ({ method: 'PUT', body: { tier } });
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

const memberViewer = (personRef: string): ActivityViewer => ({ userId: personRef, tier: 'field', class: 'member', personRef });

/** A server with missions Bo is on, and Avery signed in at command. */
async function setup() {
  const app = testApp();
  for (const id of ['a1', 'a2']) {
    const push = (name: string, args: Record<string, unknown>) => app.hub.pushAsSystem(id, SYSTEM_VIEWER, [{ name, args: { at: Date.now(), ...args } }]);
    await push('createActivity', activityArgs({ startTime: Date.now() }));
    await push('addParticipant', { personRef: BO, firstname: 'Bo', lastname: 'Okafor', unit: CRT, status: 'responding' });
  }
  const avery = app.client();
  await avery.signIn('avery.lindqvist@crt.example.org', { tier: 'command' });
  return { ...app, avery };
}

describe('tier grants', () => {
  it('give someone on the roster command on that mission only, at once', async () => {
    const { avery, client, hub } = await setup();
    const bo = client();
    await bo.signIn('bo.okafor@crt.example.org', { tier: undefined });
    const connection = connect(hub, memberViewer(BO), ['a1']);
    expect((await bo.request(grantPath())).status).toBe(403);

    const given = await avery.json<GrantResponse>(grantPath(), grant());
    expect(given.status).toBe(200);
    expect(given.body.grant).toMatchObject({ tier: 'command', grantedBy: 'avery.lindqvist@crt.example.org' });
    expect((await avery.json<GrantResponse>(grantPath())).body.grant?.tier).toBe('command');
    expect((await avery.json<GrantResponse>(grantPath(BO, 'a2'))).body.grant).toBeNull();
    // Their connection is closed, to reconnect as who they are now, and their session is up to date:
    // command on a1 (so they may grant there), not a2, without signing in again.
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

  it('are only for command to give, and only to someone on the roster', async () => {
    const { avery, client } = await setup();
    const field = client();
    await field.signIn('kai.lindqvist@crt.example.org');
    expect((await field.request(grantPath(), grant())).status).toBe(403);
    expect((await field.request(grantPath())).status).toBe(403);
    expect((await avery.json<{ error: string }>(grantPath('kcsara:2'), grant())).body.error).toBe("kcsara:2 isn't on that activity's roster");
    expect((await avery.request(grantPath(BO, 'other'), grant())).status).toBe(400);
    expect((await avery.request(grantPath(), grant('field'))).status).toBe(400);
  });
});

describe('activity kinds', () => {
  const KAI = 'kcsara:2';

  it('let members manage trainings as command, and missions only at their tier', async () => {
    const { hub } = testApp();
    await hub.pushAsSystem('t1', SYSTEM_VIEWER, [{ name: 'createActivity', args: activityArgs({ kind: 'training', startTime: Date.now() }) }]);
    await hub.pushAsSystem('m1', SYSTEM_VIEWER, [{ name: 'createActivity', args: activityArgs({ startTime: Date.now() }) }]);
    const kai = connect(hub, memberViewer(KAI), ['t1', 'm1']);
    await settle();
    expect([kai.view('t1'), kai.view('m1')]).toEqual(['command', 'field:member']);

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
    expect(kai.view('t1')).toBe('command');
    await hub.pushAsSystem('t1', SYSTEM_VIEWER, [{ name: 'updateActivity', args: { kind: 'mission' } }]);
    await settle();
    expect(kai.closed).toEqual([ACCESS_CHANGED]);
    // Back, up to date but with its copy in the command view: it starts over, as field.
    const back = connect(hub, memberViewer(KAI), [{ activityId: 't1', since: 2, view: 'command' }]);
    await settle();
    expect(back.view('t1')).toBe('field:member');
    // Up to date and in the same view: no need.
    const same = connect(hub, memberViewer(KAI), [{ activityId: 't1', since: 2, view: 'field:member' }]);
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
    // Making a training makes them command on it: they reconnect, to get it as command.
    const training = connect(hub, memberViewer(KAI), ['t2']);
    await settle();
    training.push('t2', 'createActivity', activityArgs({ kind: 'training', startTime: Date.now() }));
    await settle();
    expect(training.rejects()).toEqual([]);
    expect((await hub.actor('t2')).currentVersion).toBe(1);
    expect(training.closed).toEqual([ACCESS_CHANGED]);
    // Visitors may not.
    const visitor = connect(hub, { userId: 'adhoc:x@example.org', tier: 'field', class: 'external', personRef: 'adhoc:x@example.org' }, ['t3']);
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
      await first.set(BO, 'a1', { tier: 'support', grantedBy: 'a@example.org', grantedAt: 1000 });
      await first.set(BO, 'a1', { tier: 'command', grantedBy: 'b@example.org', grantedAt: 2000 });
      await first.set(BO, 'a2', { tier: 'support', grantedBy: 'b@example.org', grantedAt: 3000 });
      await first.close();
      const second = await PostgresGrantStore.connect(url.toString());
      expect(await second.get(BO, 'a1')).toEqual({ tier: 'command', grantedBy: 'b@example.org', grantedAt: 2000 });
      expect(await second.forPerson(BO)).toEqual({ a1: 'command', a2: 'support' });
      await second.remove(BO, 'a1');
      expect(await second.get(BO, 'a1')).toBeUndefined();
      expect(await second.forPerson(BO)).toEqual({ a2: 'support' });
      await second.close();
    } finally {
      await admin(`DROP DATABASE ${name} WITH (FORCE)`);
    }
  });
});
