import { describe, expect, it } from 'vitest';
import { encode, type ClientMessage, type Rec, type ServerMessage } from '@sync/core';
import { Hub, MemoryStorage, type HubConnection } from '@sync/server';
import { missionProjector, missionRegistry, participantIdFor, type MissionViewer } from '@sync/domain';
import { COMMAND, CRT, HOUR, T0, eventArgs, fieldMember } from '../../packages/domain/__tests__/helpers';

/** The real event actor with the mission domain, over fake connections. */
function connect(hub: Hub, viewer: MissionViewer, clientId: string) {
  const received: ServerMessage[] = [];
  const transport: HubConnection = { viewer, send: (text) => received.push(JSON.parse(text) as ServerMessage), close: () => {} };
  const handlers = hub.connect(transport);
  const send = (msg: ClientMessage) => handlers.message(encode(msg));
  send({ t: 'hello', clientId, build: 'test', subs: [{ eventId: 'e1', since: 0 }] });
  let nextId = 1;
  return {
    received,
    push: (name: string, args: Record<string, unknown>) => send({ t: 'push', eventId: 'e1', mutations: [{ id: nextId++, name, v: 1, args, clientTime: T0 }] }),
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

describe('mission domain on the event actor', () => {
  it('applies mutations and sends each view only what it may see', async () => {
    const hub = new Hub({ storage: new MemoryStorage(), registry: missionRegistry, projector: missionProjector, now: () => T0 + 2 * HOUR });
    const command = connect(hub, COMMAND, 'c-command');
    const field = connect(hub, fieldMember('kcsara:85205'), 'c-field');

    command.push('createEvent', eventArgs());
    // Separate connections: wait until the event exists before the field client signs in.
    await until(() => field.records().has('event/event'));
    const me = participantIdFor('kcsara:85205');
    field.push('addParticipant', { personRef: 'kcsara:85205', firstname: 'Anna', lastname: 'Lee', unit: CRT, status: 'responding', at: T0 + HOUR });
    await until(() => command.records().has(`participant/${me}`));
    command.push('setMiles', { participantId: me, miles: 40 });
    command.push('addComm', { id: 'c1', from: 'Base', to: 'All', message: 'Briefing at 1500', at: T0 + HOUR });
    await until(() => command.records().has('comm/c1'));

    expect(command.records().get(`participant/${me}`)).toMatchObject({ firstname: 'Anna', miles: 40 });
    expect(field.records().get(`participant/${me}`)).toMatchObject({ firstname: 'Anna', personRef: 'kcsara:85205' });
    expect(field.records().get(`participant/${me}`)).not.toHaveProperty('miles');
    expect(field.records().has('comm/c1')).toBe(false);
    expect(field.records().get('event/event')).toMatchObject({ title: 'Lost hiker, Mailbox Peak' });

    // A field member can't log comms; the actor rejects it.
    field.push('addComm', { id: 'c2', from: '', to: '', message: 'hi', at: T0 + HOUR });
    await until(() => field.received.some((m) => m.t === 'reject'));
  });
});
