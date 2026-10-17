import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncClient } from '@sync/client';
import { Hub, MemoryStorage } from '@sync/server';
import { ACTIVITY_LIST_ID, activityProjector, activityRegistry, participantIdFor, type ActivitySummaryRec } from '@sync/domain';
import { SummaryWriter } from '../../server/src/summaries';
import { COMMAND, CRT, HOUR, T0, activityArgs, fieldMember } from '../../packages/domain/__tests__/helpers';
import { SimNetwork, mulberry32 } from './sim';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0 + 2 * HOUR);
});
afterEach(() => vi.useRealTimers());

async function setup(storage = new MemoryStorage()) {
  const summaries = new SummaryWriter(() => hub);
  const hub: Hub = new Hub({ storage, registry: activityRegistry, projector: activityProjector, now: () => Date.now(), onCommit: summaries.onCommit, readOnly: (id) => id === ACTIVITY_LIST_ID });
  const net = new SimNetwork(hub, mulberry32(1));
  net.latencyMs = 20;
  const viewers = [COMMAND, fieldMember('kcsara:1')];
  const [command, field] = viewers.map((viewer, i) => new SyncClient({ registry: activityRegistry, viewer, transport: net.transportFor(i, viewer) }));
  for (const c of [command!, field!]) await c.start();
  await command!.open('a1');
  await field!.open(ACTIVITY_LIST_ID);
  const summaryWrites = () => storage.log.filter((e) => e.activityId === ACTIVITY_LIST_ID).length;
  const listed = () => field!.snapshot(ACTIVITY_LIST_ID).get<ActivitySummaryRec>('activitySummary', 'a1');
  return { hub, storage, summaries, command: command!, field: field!, summaryWrites, listed, stop: () => [command, field].forEach((c) => c!.stop()) };
}

describe('activity summaries on the server', () => {
  it('list an activity after the debounce, once for a burst of changes', async () => {
    const s = await setup();
    s.command.mutate('a1', 'createActivity', activityArgs());
    s.command.mutate('a1', 'addParticipant', { personRef: 'kcsara:1', firstname: 'Anna', lastname: 'Lee', unit: CRT, status: 'staging', at: T0 + HOUR });
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.listed()).toBeUndefined(); // still inside the 2 s debounce
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.listed()?.activity.title).toBe('Lost hiker, Mailbox Peak');
    expect(s.listed()?.people[participantIdFor('kcsara:1')]?.status).toBe('staging');
    expect(s.summaryWrites()).toBe(1);
    s.stop();
  });

  it('writes within 5 s even while changes keep coming', async () => {
    const s = await setup();
    s.command.mutate('a1', 'createActivity', activityArgs());
    for (let i = 0; i < 6; i++) {
      s.command.mutate('a1', 'updateActivity', { title: `Title ${i}` });
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(s.summaryWrites()).toBeGreaterThanOrEqual(1);
    s.stop();
  });

  it('drops a removed activity from the list', async () => {
    const s = await setup();
    s.command.mutate('a1', 'createActivity', activityArgs());
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.listed()).toBeDefined();
    s.command.mutate('a1', 'removeActivity', {});
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.listed()).toBeUndefined();
    s.stop();
  });

  it('refuses clients writing to the list', async () => {
    const s = await setup();
    const rejected: string[] = [];
    // Passes the client's own checks (the list has no activity record yet), so only the server can refuse it.
    await s.command.open(ACTIVITY_LIST_ID);
    s.command.onReject((r) => rejected.push(r.message));
    s.command.mutate(ACTIVITY_LIST_ID, 'createActivity', activityArgs());
    await vi.advanceTimersByTimeAsync(500);
    expect(rejected).toEqual(['Only the server changes this']);
    expect(s.command.snapshot(ACTIVITY_LIST_ID).get('activity', 'activity')).toBeUndefined();
    s.stop();
  });

  it('backfills activities stored before summaries existed', async () => {
    const storage = new MemoryStorage();
    // An older server, without summaries.
    const old = new Hub({ storage, registry: activityRegistry, projector: activityProjector, now: () => Date.now() });
    const net = new SimNetwork(old, mulberry32(2));
    const client = new SyncClient({ registry: activityRegistry, viewer: COMMAND, transport: net.transportFor(0, COMMAND) });
    await client.start();
    await client.open('a1');
    client.mutate('a1', 'createActivity', activityArgs());
    await vi.advanceTimersByTimeAsync(500);
    client.stop();

    const s = await setup(storage);
    expect(await s.summaries.backfill(storage)).toBe(1);
    expect(await s.summaries.backfill(storage)).toBe(0); // already listed
    await vi.advanceTimersByTimeAsync(500);
    expect(s.listed()?.activity.title).toBe('Lost hiker, Mailbox Peak');
    s.stop();
  });
});
