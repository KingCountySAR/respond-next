import { describe, expect, it } from 'vitest';
import { encode, type ClientMessage, type ReadView, type ServerMessage } from '@sync/core';
import { Hub, MemoryStorage } from '@sync/server';
import { testProjector, testRegistry, type Person } from '../../sync-core/__tests__/testDomain';

const COMMAND = { userId: 'u1', tier: 'command' };
const SYSTEM = { userId: 'system', tier: 'command' };

function connect(hub: Hub, activityId: string) {
  const received: ServerMessage[] = [];
  const handlers = hub.connect({ viewer: COMMAND, send: (text) => received.push(JSON.parse(text) as ServerMessage), close: () => {} });
  const send = (msg: ClientMessage) => handlers.message(encode(msg));
  send({ t: 'hello', clientId: 'c1', build: 'test', subs: [{ activityId, since: 0 }] });
  let nextId = 1;
  return {
    received,
    push: (name: string, args: Record<string, unknown>) => send({ t: 'push', activityId, mutations: [{ id: nextId++, name, v: 1, args, clientTime: 0 }] }),
  };
}

const settle = () => new Promise((r) => setTimeout(r, 20));

describe('hub', () => {
  it('reports each commit with a live view of the records', async () => {
    const commits: { activityId: string; view: ReadView }[] = [];
    const hub = new Hub({ storage: new MemoryStorage(), registry: testRegistry, projector: testProjector, now: Date.now, onCommit: (activityId, view) => commits.push({ activityId, view }) });
    const client = connect(hub, 'a1');
    client.push('addPerson', { id: 'p1', name: 'Anna' });
    await settle();
    expect(commits.map((c) => c.activityId)).toEqual(['a1']);
    client.push('renamePerson', { id: 'p1', name: 'Ann' });
    await settle();
    // The first view is live, so it shows the rename too.
    expect(commits[0]!.view.get<Person>('person', 'p1')?.name).toBe('Ann');
  });

  it("applies the server's own changes, logged and fanned out like a client's", async () => {
    const storage = new MemoryStorage();
    const hub = new Hub({ storage, registry: testRegistry, projector: testProjector, now: Date.now });
    const client = connect(hub, 'a1');
    await settle();
    await hub.pushAsSystem('a1', SYSTEM, [{ name: 'addPerson', args: { id: 'p9', name: 'From the server' } }]);
    await hub.pushAsSystem('a1', SYSTEM, [{ name: 'renamePerson', args: { id: 'p9', name: 'Renamed' } }]);
    await settle();
    expect(storage.log.map((e) => [e.clientId, e.mutationId, e.outcome])).toEqual([
      ['system', 1, 'applied'],
      ['system', 2, 'applied'],
    ]);
    const upserts = client.received.flatMap((m) => (m.t === 'update' ? m.upserts : []));
    expect(upserts.map((r) => (r as Person).name)).toEqual(['From the server', 'Renamed']);
  });

  it('lets a connection be someone else on one activity, and itself on the rest', async () => {
    const hub = new Hub({ storage: new MemoryStorage(), registry: testRegistry, projector: testProjector, now: Date.now });
    for (const id of ['a1', 'a2']) {
      await hub.pushAsSystem(id, SYSTEM, [
        { name: 'addPerson', args: { id: 'p1', name: 'Anna' } },
        { name: 'setNote', args: { id: 'p1', note: 'command only' } },
      ]);
    }
    const received: ServerMessage[] = [];
    const field = { userId: 'u2', tier: 'field' };
    // Command on a1 only; undefined, the usual case, is the connection's own viewer.
    const handlers = hub.connect({ viewer: field, viewerIn: (id) => (id === 'a1' ? { ...field, tier: 'command' } : undefined), send: (text) => received.push(JSON.parse(text) as ServerMessage), close: () => {} });
    const send = (msg: ClientMessage) => handlers.message(encode(msg));
    send({ t: 'hello', clientId: 'c2', build: 'test', subs: [{ activityId: 'a1', since: 0 }, { activityId: 'a2', since: 0 }] });
    await settle();
    const notes = Object.fromEntries(received.flatMap((m) => (m.t === 'reset' ? [[m.activityId, (m.records[0] as Person & { note?: string }).note]] : [])));
    expect(notes).toEqual({ a1: 'command only', a2: undefined });

    for (const activityId of ['a1', 'a2']) send({ t: 'push', activityId, mutations: [{ id: activityId === 'a1' ? 1 : 2, name: 'setNote', v: 1, args: { id: 'p1', note: 'changed' }, clientTime: 0 }] });
    await settle();
    expect(received.filter((m) => m.t === 'reject').map((m) => m.t === 'reject' && [m.activityId, m.reason])).toEqual([['a2', 'forbidden']]);
  });

  it('refuses client changes to a read-only scope', async () => {
    const hub = new Hub({ storage: new MemoryStorage(), registry: testRegistry, projector: testProjector, now: Date.now, readOnly: (id) => id === 'list' });
    const client = connect(hub, 'list');
    client.push('addPerson', { id: 'p1', name: 'Anna' });
    await settle();
    expect(client.received.filter((m) => m.t === 'reject').map((m) => m.t === 'reject' && m.reason)).toEqual(['read_only']);
    expect((await hub.actor('list')).currentVersion).toBe(0);
  });
});
