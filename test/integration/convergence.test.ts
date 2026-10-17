import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncClient } from '@sync/client';
import { Rejection, randomId, recKey, type Rec, type Viewer } from '@sync/core';
import { Hub, MemoryStorage } from '@sync/server';
import { STATUSES, toyProjector, toyRegistry, type Person } from '@sync/toy-domain';
import { SimNetwork, mulberry32 } from './sim';

const EVENT = 'e1';
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const STEPS = 300;

const sortByKey = (recs: Iterable<Rec>) => [...recs].sort((a, b) => recKey(a).localeCompare(recKey(b)));

describe('convergence over a bad network', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(SEEDS)('seed %i: every client ends with exactly its server view', async (seed) => {
    const rand = mulberry32(seed);
    const pick = <T>(items: readonly T[]): T | undefined => items[Math.floor(rand() * items.length)];
    const storage = new MemoryStorage();
    const hub = new Hub({ storage, registry: toyRegistry, projector: toyProjector, now: () => Date.now() });
    const net = new SimNetwork(hub, rand);
    const viewers: Viewer[] = [
      { userId: 'cmd1', tier: 'command' },
      { userId: 'cmd2', tier: 'command' },
      { userId: 'fld1', tier: 'field' },
      { userId: 'fld2', tier: 'field' },
    ];
    const clients = viewers.map((viewer, i) => new SyncClient({ registry: toyRegistry, viewer, transport: net.transportFor(i, viewer) }));
    for (const c of clients) {
      await c.start();
      await c.open(EVENT);
    }

    const act = (i: number) => {
      const client = clients[i]!;
      const viewer = viewers[i]!;
      const people = [...client.snapshot(EVENT).scan<Person>('person')];
      const person = pick(people);
      const roll = rand();
      try {
        if (roll < 0.3 || !person) client.mutate(EVENT, 'addPerson', { id: randomId(), name: `p${Math.floor(rand() * 1000)}` });
        else if (roll < 0.5) client.mutate(EVENT, 'renamePerson', { id: person.id, name: `r${Math.floor(rand() * 1000)}` });
        else if (roll < 0.8) {
          const backdate = rand() < 0.3 ? Math.floor(rand() * 30 * 60_000) : 0;
          client.mutate(EVENT, 'setStatus', { personId: person.id, status: pick(STATUSES), at: client.now() - backdate });
        } else if (viewer.tier === 'command' && roll < 0.95) client.mutate(EVENT, 'setNote', { id: person.id, note: `n${seed}-${roll}` });
        else if (viewer.tier === 'command') client.mutate(EVENT, 'removePerson', { id: person.id });
      } catch (err) {
        if (!(err instanceof Rejection)) throw err;
      }
    };

    for (let step = 0; step < STEPS; step++) {
      const roll = rand();
      const i = Math.floor(rand() * clients.length);
      if (roll < 0.6) act(i);
      else if (roll < 0.7) {
        if (net.down.has(i)) net.restore(i);
        else net.cut(i);
      } else if (roll < 0.75) net.latencyMs = 20 + Math.floor(rand() * 2000);
      await vi.advanceTimersByTimeAsync(Math.floor(rand() * 400));
    }

    // Heal the network and let every client reconnect, resend and catch up.
    for (let i = 0; i < clients.length; i++) net.restore(i);
    net.latencyMs = 50;
    await vi.advanceTimersByTimeAsync(120_000);

    // Guard against a vacuous pass: the run must have pushed real traffic through the server.
    const applied = storage.log.filter((e) => e.outcome === 'applied').length;
    expect(applied, 'mutations applied on the server').toBeGreaterThan(60);
    expect(new Set(storage.log.map((e) => `${e.clientId}:${e.mutationId}`)).size, 'each mutation logged once').toBe(storage.log.length);

    const actor = await hub.actor(EVENT);
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i]!;
      const snap = client.snapshot(EVENT);
      expect(client.status.state, `client ${i} connection`).toBe('live');
      expect(snap.pending, `client ${i} pending`).toEqual([]);
      const expected = actor.projectedRecords(toyProjector.viewKey(viewers[i]!));
      expect(sortByKey(snap.all()), `client ${i} records`).toEqual(sortByKey(expected));
      if (viewers[i]!.tier === 'field') {
        for (const p of snap.scan('person')) expect(p, 'field view must not include notes').not.toHaveProperty('note');
      }
    }
    for (const c of clients) c.stop();
  });
});
