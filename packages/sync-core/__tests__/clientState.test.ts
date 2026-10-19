import { describe, expect, it } from 'vitest';
import { ClientActivityState, Rejection, type Rec, type WireMutation } from '@sync/core';
import { currentStatus, testRegistry, type Person } from './testDomain';

const viewer = { userId: 'u1', tier: 'command' };
const newState = () => new ClientActivityState('e1', testRegistry, () => viewer, 'client-a');

let nextId = 1;
const wire = (name: string, args: Record<string, unknown>): WireMutation => ({ id: nextId++, name, v: 1, args, clientTime: 0 });
const person = (id: string, name: string, version: number, note: string | null = null): Rec => ({ type: 'person', id, version, name, note });

describe('ClientActivityState', () => {
  it('shows a local change at once and marks it pending', () => {
    const s = newState();
    s.addLocal(wire('addPerson', { id: 'p1', name: 'Bob' }));
    expect(s.snapshot.get<Person>('person', 'p1')?.name).toBe('Bob');
    expect(s.snapshot.pendingKeys.has('person/p1')).toBe(true);
  });

  it('drops pending mutations the server confirms', () => {
    const s = newState();
    const m = wire('addPerson', { id: 'p1', name: 'Bob' });
    s.addLocal(m);
    s.applyUpdate({ t: 'update', activityId: 'e1', from: 0, to: 1, upserts: [person('p1', 'Bob', 1)], deletes: [], lastMutationId: m.id });
    expect(s.pending).toEqual([]);
    expect(s.snapshot.get('person', 'p1')?.version).toBe(1);
    expect(s.snapshot.pendingKeys.size).toBe(0);
  });

  it("rebases a pending rename onto someone else's change to the same record", () => {
    const s = newState();
    s.applyReset({ t: 'reset', activityId: 'e1', to: 1, records: [person('p1', 'Bob', 1)], lastMutationId: 0 });
    s.addLocal(wire('renamePerson', { id: 'p1', name: 'Robert' }));
    s.applyUpdate({ t: 'update', activityId: 'e1', from: 1, to: 2, upserts: [person('p1', 'Bob', 2, 'has radio')], deletes: [], lastMutationId: 0 });
    const p = s.snapshot.get<Person>('person', 'p1');
    expect(p?.name).toBe('Robert');
    expect(p?.note).toBe('has radio');
  });

  it('removes the effect of a rejected mutation', () => {
    const s = newState();
    const m = wire('addPerson', { id: 'p1', name: 'Bob' });
    s.addLocal(m);
    const dropped = s.applyReject(m.id);
    expect(dropped?.description).toBe('Add Bob');
    expect(s.snapshot.get('person', 'p1')).toBeUndefined();
    expect(s.pending).toEqual([]);
  });

  it('hides a pending change that no longer applies, but keeps it until the server answers', () => {
    const s = newState();
    s.applyReset({ t: 'reset', activityId: 'e1', to: 1, records: [person('p1', 'Bob', 1)], lastMutationId: 0 });
    s.addLocal(wire('setStatus', { personId: 'p1', status: 'assigned', at: 1000 }));
    expect(currentStatus(s.snapshot, 'p1')?.status).toBe('assigned');
    s.applyUpdate({ t: 'update', activityId: 'e1', from: 1, to: 2, upserts: [], deletes: [{ type: 'person', id: 'p1' }], lastMutationId: 0 });
    expect(currentStatus(s.snapshot, 'p1')).toBeUndefined();
    expect(s.pending).toHaveLength(1);
  });

  it('refuses an update that does not follow on from its version', () => {
    const s = newState();
    expect(s.applyUpdate({ t: 'update', activityId: 'e1', from: 5, to: 6, upserts: [], deletes: [], lastMutationId: 0 })).toBe(false);
    expect(s.version).toBe(0);
  });

  it('does not queue a mutation that fails locally', () => {
    const s = newState();
    expect(() => s.addLocal(wire('renamePerson', { id: 'missing', name: 'X' }))).toThrow(Rejection);
    expect(s.pending).toEqual([]);
  });

  it('orders status by `at`, so a backdated entry does not replace a newer one', () => {
    const s = newState();
    s.applyReset({ t: 'reset', activityId: 'e1', to: 1, records: [person('p1', 'Bob', 1)], lastMutationId: 0 });
    s.addLocal(wire('setStatus', { personId: 'p1', status: 'clear', at: 2000 }));
    s.addLocal(wire('setStatus', { personId: 'p1', status: 'assigned', at: 1000 }));
    expect(currentStatus(s.snapshot, 'p1')?.status).toBe('clear');
  });
});
