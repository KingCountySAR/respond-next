import { describe, expect, it } from 'vitest';
import { encode, type ClientMessage, type Rec, type ServerMessage } from '@sync/core';
import { Hub, MemoryStorage, type HubConnection } from '@sync/server';
import { activityProjector, activityRegistry, participantIdFor, type ActivityViewer } from '@sync/domain';
import { MANAGER, CRT, HOUR, T0, activityArgs, respondMember } from '../../packages/domain/__tests__/helpers';

/** The real activity actor with the activity domain, over fake connections. */
function connect(hub: Hub, viewer: ActivityViewer, clientId: string) {
  const received: ServerMessage[] = [];
  const transport: HubConnection = { viewer, send: (text) => received.push(JSON.parse(text) as ServerMessage), close: () => {} };
  const handlers = hub.connect(transport);
  const send = (msg: ClientMessage) => handlers.message(encode(msg));
  send({ t: 'hello', clientId, build: 'test', subs: [{ activityId: 'e1', since: 0 }] });
  let nextId = 1;
  return {
    received,
    push: (name: string, args: Record<string, unknown>) => send({ t: 'push', activityId: 'e1', mutations: [{ id: nextId++, name, v: 1, args, clientTime: T0 }] }),
    /** Everything this client has been sent for e1, latest copy of each record. */
    records(): Map<string, Rec> {
      const out = new Map<string, Rec>();
      for (const m of received) {
        if (m.t === 'reset') for (const r of m.records) out.set(`${r.type}/${r.id}`, r);
        if (m.t === 'update') {
          for (const r of m.upserts) out.set(`${r.type}/${r.id}`, r);
          for (const d of m.deletes) out.delete(`${d.type}/${d.id}`);
        }
      }
      return out;
    },
  };
}

async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(check()).toBe(true);
}

describe('activity domain on the activity actor', () => {
  it("answers an unknown activity with nothing, and stores nothing for it until it's created", async () => {
    const storage = new MemoryStorage();
    const hub = new Hub({ storage, registry: activityRegistry, projector: activityProjector, now: () => T0 + 2 * HOUR });
    const respond = connect(hub, respondMember('kcsara:85205'), 'c-respond');
    await until(() => respond.received.length > 0);
    expect(respond.received[0]).toMatchObject({ t: 'reset', activityId: 'e1', to: 0, records: [] });

    // A change to it is refused, and leaves no trace.
    respond.push('addParticipant', { personRef: 'kcsara:85205', firstname: 'Anna', lastname: 'Lee', unit: CRT, status: 'responding', at: T0 + HOUR });
    await until(() => respond.received.some((m) => m.t === 'reject'));
    expect(respond.received.find((m) => m.t === 'reject')).toMatchObject({ reason: 'no_activity' });
    expect(await storage.load('e1')).toBeUndefined();

    // Creating it works as ever, and the open client sees it.
    const manage = connect(hub, MANAGER, 'c-manager');
    manage.push('createActivity', activityArgs());
    await until(() => respond.records().has('activity/activity'));
    expect((await storage.load('e1'))?.version).toBe(1);
  });

  it('applies mutations and sends each view only what it may see', async () => {
    const hub = new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: () => T0 + 2 * HOUR });
    const manage = connect(hub, MANAGER, 'c-manager');
    const respond = connect(hub, respondMember('kcsara:85205'), 'c-respond');

    manage.push('createActivity', activityArgs());
    // Separate connections: wait until the activity exists before the respond client signs in.
    await until(() => respond.records().has('activity/activity'));
    const me = participantIdFor('kcsara:85205');
    respond.push('addParticipant', { personRef: 'kcsara:85205', firstname: 'Anna', lastname: 'Lee', unit: CRT, status: 'responding', at: T0 + HOUR });
    await until(() => manage.records().has(`participant/${me}`));
    manage.push('setMiles', { participantId: me, miles: 40 });
    manage.push('addComm', { id: 'c1', from: 'Base', to: 'All', message: 'Briefing at 1500', at: T0 + HOUR });
    await until(() => manage.records().has('comm/c1'));

    expect(manage.records().get(`participant/${me}`)).toMatchObject({ firstname: 'Anna', miles: 40 });
    expect(respond.records().get(`participant/${me}`)).toMatchObject({ firstname: 'Anna', personRef: 'kcsara:85205' });
    expect(respond.records().get(`participant/${me}`)).toMatchObject({ miles: 40 });
    expect(respond.records().has('comm/c1')).toBe(false);
    expect(respond.records().get('activity/activity')).toMatchObject({ title: 'Lost hiker, Mailbox Peak' });

    // A respond member can't log comms; the actor rejects it.
    respond.push('addComm', { id: 'c2', from: '', to: '', message: 'hi', at: T0 + HOUR });
    await until(() => respond.received.some((m) => m.t === 'reject'));
  });
});
