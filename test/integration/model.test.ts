import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reaction } from 'mobx';
import { SyncClient } from '@sync/client';
import { Hub, MemoryStorage } from '@sync/server';
import { activityProjector, activityRegistry, participantIdFor, type ActivityViewer } from '@sync/domain';
import { createActivityModel, isManageActivity, type ManageActivity } from '@sync/model';
import { MANAGER, CRT, EXTERNAL, HOUR, T0, activityArgs, respondMember } from '../../packages/domain/__tests__/helpers';
import { SimNetwork, mulberry32 } from './sim';

const ACTIVITY = 'e1';

describe('activity models over the network', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 2 * HOUR);
  });
  afterEach(() => vi.useRealTimers());

  async function connect() {
    const hub = new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: () => Date.now() });
    const net = new SimNetwork(hub, mulberry32(1));
    net.latencyMs = 50;
    const viewers: ActivityViewer[] = [MANAGER, { ...MANAGER, userId: 'u-manager-2' }, respondMember('kcsara:1'), EXTERNAL];
    const clients = viewers.map((viewer, i) => new SyncClient({ registry: activityRegistry, viewer, transport: net.transportFor(i, viewer) }));
    for (const c of clients) {
      await c.start();
      await c.open(ACTIVITY);
    }
    const [mine, theirs, member, external] = clients.map((c) => createActivityModel(c, ACTIVITY));
    const stop = () => clients.forEach((c) => c.stop());
    return { mine: mine as ManageActivity, theirs: theirs as ManageActivity, member: member!, external: external!, stop };
  }

  it("shows others' changes, and when your own are confirmed", async () => {
    const { mine, theirs, stop } = await connect();
    const anna = participantIdFor('kcsara:1');
    mine.mutate('createActivity', activityArgs());
    mine.mutate('addParticipant', { personRef: 'kcsara:1', firstname: 'Anna', lastname: 'Lee', unit: CRT, status: 'staging', at: T0 + HOUR });
    await vi.advanceTimersByTimeAsync(1000);
    expect(mine.participant(anna)!.isPending).toBe(false);
    expect(theirs.participant(anna)!.status).toBe('staging');

    const seen: string[] = [];
    const stopReaction = reaction(() => theirs.participant(anna)!.status, (s) => seen.push(s));
    mine.participant(anna)!.setStatus('demobilizing');
    expect(mine.participant(anna)!.status).toBe('demobilizing');
    expect(mine.participant(anna)!.isPending).toBe(true);
    expect(seen).toEqual([]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual(['demobilizing']);
    expect(mine.participant(anna)!.isPending).toBe(false);
    stopReaction();
    stop();
  });

  it('gives members and external people the respond model over their projection', async () => {
    const { mine, member, external, stop } = await connect();
    expect([isManageActivity(mine), isManageActivity(member), isManageActivity(external)]).toEqual([true, false, false]);
    const anna = participantIdFor('kcsara:1');
    const ext = participantIdFor('adhoc:ext-1');
    mine.mutate('createActivity', activityArgs());
    mine.mutate('createTeam', { id: 't1', name: 'Team 1' });
    mine.mutate('addParticipant', { personRef: 'kcsara:1', firstname: 'Anna', lastname: 'Lee', unit: CRT, status: 'staging', at: T0 + HOUR });
    mine.mutate('addParticipant', { personRef: 'adhoc:ext-1', firstname: 'Eli', lastname: 'Mutual', unit: CRT, status: 'staging', at: T0 + HOUR });
    mine.mutate('setMiles', { participantId: anna, miles: 40 });
    mine.participant(anna)!.assign({ kind: 'team', id: 't1' });
    await vi.advanceTimersByTimeAsync(1000);

    expect(mine.participant(anna)).toMatchObject({ status: 'assigned', locationName: 'Team 1' });
    expect(mine.participant(anna)!.record).toMatchObject({ miles: 40, personRef: 'kcsara:1' });

    // A member sees their own entry, mileage, and which kind of place people are at, but not team notes.
    expect(member.me?.id).toBe(anna);
    expect(member.me?.isMe).toBe(true);
    expect(member.participant(anna)).toMatchObject({ status: 'assigned', targetKind: 'team' });
    expect(member.participant(anna)!.record).toMatchObject({ personRef: 'kcsara:1', miles: 40 });
    expect(member.team('t1')?.name).toBe('Team 1');
    expect(member.team('t1')!.record).not.toHaveProperty('notes');

    // An external person finds themselves by id, and sees no person refs or assignments.
    expect(external.me?.id).toBe(ext);
    expect(external.participant(anna)!.record?.personRef).toBeUndefined();
    expect(external.participant(anna)!.targetKind).toBeUndefined();
    expect(external.participant(anna)!.status).toBe('assigned');

    // Self-service works from the respond model; the server applies it for everyone.
    member.me!.setEta(T0 + 3 * HOUR);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mine.participant(anna)!.record?.eta).toBe(T0 + 3 * HOUR);
    stop();
  });

  it('projects operations: names and equipment for respond viewers, the rest for managers', async () => {
    const { mine, member, external, stop } = await connect();
    mine.mutate('createActivity', activityArgs());
    const anna = mine.addParticipant({ personRef: 'kcsara:1', firstname: 'Anna', lastname: 'Lee' }, CRT, 'staging', { at: T0 + HOUR });
    const lz = mine.createPlace({ name: 'LZ', notes: 'Gravel lot' });
    const division = mine.createGroup('Division A');
    division.setLeader(anna);
    mine.addEquipment('inventory-11', lz.asTarget);
    mine.setUnitStatus(CRT, 'responding');
    mine.logComm({ from: 'Base', to: 'LZ', message: 'Helicopter inbound' });
    await vi.advanceTimersByTimeAsync(1000);

    for (const field of [member, external]) {
      expect(field.places.map((p) => p.name)).toEqual(['Command Post', 'Field', 'LZ']);
      expect(field.place(lz.id)!.record).not.toHaveProperty('notes');
      expect(field.equipment.map((e) => [e.name, e.locationName])).toEqual([['Litter', 'LZ']]);
      expect(field.units.map((u) => [u.name, u.status])).toEqual([['CRT', 'responding']]);
      expect([...field.store.scan('comm')]).toEqual([]);
    }
    expect(member.group(division.id)!.leader?.id).toBe(anna.id);
    expect(external.group(division.id)!.name).toBe('Division A');
    expect(external.group(division.id)!.leader).toBeUndefined();
    expect(mine.comms.map((c) => c.message)).toEqual(['Helicopter inbound']);
    stop();
  });
});
