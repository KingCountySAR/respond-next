import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncClient } from '@sync/client';
import { Hub, MemoryStorage } from '@sync/server';
import { ACTIVITY_ARCHIVE_ID, ACTIVITY_LIST_HISTORY_DAYS, ACTIVITY_LIST_ID, SYSTEM_VIEWER, activityProjector, activityRegistry, participantIdFor, type ActivitySummaryRec } from '@sync/domain';
import { SummaryWriter } from '../../server/src/summaries';
import { MANAGER, CRT, HOUR, T0, activityArgs, respondMember } from '../../packages/domain/__tests__/helpers';
import { SimNetwork, mulberry32 } from './sim';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0 + 2 * HOUR);
});
afterEach(() => vi.useRealTimers());

const DAY = 24 * HOUR;

async function setup(storage = new MemoryStorage()) {
  // Days pass for the list's history (`later`) without the clients' timers running through them.
  let shift = 0;
  const summaries = new SummaryWriter(() => hub, { now: () => Date.now() + shift });
  const hub: Hub = new Hub({ storage, registry: activityRegistry, projector: activityProjector, now: () => Date.now(), onCommit: summaries.onCommit, readOnly: (id) => id === ACTIVITY_LIST_ID || id === ACTIVITY_ARCHIVE_ID });
  const net = new SimNetwork(hub, mulberry32(1));
  net.latencyMs = 20;
  const viewers = [MANAGER, respondMember('kcsara:1')];
  const [manage, respond] = viewers.map((viewer, i) => new SyncClient({ registry: activityRegistry, viewer, transport: net.transportFor(i, viewer) }));
  for (const c of [manage!, respond!]) await c.start();
  await manage!.open('a1');
  await respond!.open(ACTIVITY_LIST_ID);
  const summaryWrites = () => storage.log.filter((e) => e.activityId === ACTIVITY_LIST_ID).length;
  const listed = () => respond!.snapshot(ACTIVITY_LIST_ID).get<ActivitySummaryRec>('activitySummary', 'a1');
  const archived = async () => (await hub.read(ACTIVITY_ARCHIVE_ID, SYSTEM_VIEWER)).records.find((r) => r.id === 'a1') as ActivitySummaryRec | undefined;
  const later = (ms: number) => (shift += ms);
  return { hub, storage, summaries, manage: manage!, respond: respond!, summaryWrites, listed, archived, later, stop: () => [manage, respond].forEach((c) => c!.stop()) };
}

describe('activity summaries on the server', () => {
  it('list an activity after the debounce, once for a burst of changes', async () => {
    const s = await setup();
    s.manage.mutate('a1', 'createActivity', activityArgs());
    s.manage.mutate('a1', 'addParticipant', { personRef: 'kcsara:1', firstname: 'Anna', lastname: 'Lee', unit: CRT, status: 'staging', at: T0 + HOUR });
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
    s.manage.mutate('a1', 'createActivity', activityArgs());
    for (let i = 0; i < 6; i++) {
      s.manage.mutate('a1', 'updateActivity', { title: `Title ${i}` });
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(s.summaryWrites()).toBeGreaterThanOrEqual(1);
    s.stop();
  });

  it('drops a removed activity from the list', async () => {
    const s = await setup();
    s.manage.mutate('a1', 'createActivity', activityArgs());
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.listed()).toBeDefined();
    s.manage.mutate('a1', 'removeActivity', {});
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.listed()).toBeUndefined();
    s.stop();
  });

  it('keeps every activity in the archive, and in the list only while open or recent', async () => {
    const s = await setup();
    s.manage.mutate('a1', 'createActivity', activityArgs());
    s.manage.mutate('a1', 'closeActivity', {});
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.listed()?.activity.closed).toBe(true); // ended today
    expect((await s.archived())?.activity.closed).toBe(true);

    s.later((ACTIVITY_LIST_HISTORY_DAYS - 1) * DAY);
    await s.summaries.prune();
    await vi.advanceTimersByTimeAsync(500);
    expect(s.listed()).toBeDefined();

    s.later(2 * DAY);
    await s.summaries.prune();
    await vi.advanceTimersByTimeAsync(500);
    expect(s.listed()).toBeUndefined();
    expect((await s.archived())?.activity.title).toBe('Lost hiker, Mailbox Peak');

    // Reactivated: back in the list.
    s.manage.mutate('a1', 'reopenActivity', {});
    await vi.advanceTimersByTimeAsync(3000);
    expect(s.listed()?.activity.closed).toBe(false);
    s.stop();
  });

  it('refuses clients writing to the list', async () => {
    const s = await setup();
    const rejected: string[] = [];
    // Passes the client's own checks (the list has no activity record yet), so only the server can refuse it.
    await s.manage.open(ACTIVITY_LIST_ID);
    s.manage.onReject((r) => rejected.push(r.message));
    s.manage.mutate(ACTIVITY_LIST_ID, 'createActivity', activityArgs());
    await vi.advanceTimersByTimeAsync(500);
    expect(rejected).toEqual(['Only the server changes this']);
    expect(s.manage.snapshot(ACTIVITY_LIST_ID).get('activity', 'activity')).toBeUndefined();
    s.stop();
  });

  it('backfills activities stored before summaries existed', async () => {
    const storage = new MemoryStorage();
    // An older server, without summaries.
    const old = new Hub({ storage, registry: activityRegistry, projector: activityProjector, now: () => Date.now() });
    const net = new SimNetwork(old, mulberry32(2));
    const client = new SyncClient({ registry: activityRegistry, viewer: MANAGER, transport: net.transportFor(0, MANAGER) });
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

  it("doesn't load archived activities at startup, and drops those that aged out while it was down", async () => {
    const storage = new MemoryStorage();
    const first = await setup(storage);
    first.manage.mutate('a1', 'createActivity', activityArgs());
    first.manage.mutate('a1', 'closeActivity', {});
    await vi.advanceTimersByTimeAsync(3000);
    expect(first.listed()).toBeDefined();
    first.stop();

    // The next server starts weeks later.
    const loads = vi.spyOn(storage, 'load');
    const summaries = new SummaryWriter(() => hub, { now: () => Date.now() + (ACTIVITY_LIST_HISTORY_DAYS + 1) * DAY });
    const hub: Hub = new Hub({ storage, registry: activityRegistry, projector: activityProjector, now: () => Date.now(), onCommit: summaries.onCommit });
    expect(await summaries.backfill(storage)).toBe(0);
    expect(loads.mock.calls.map(([id]) => id).sort()).toEqual([ACTIVITY_LIST_ID, ACTIVITY_ARCHIVE_ID].sort());
    expect((await hub.read(ACTIVITY_LIST_ID, SYSTEM_VIEWER)).records).toEqual([]);
    expect((await hub.read(ACTIVITY_ARCHIVE_ID, SYSTEM_VIEWER)).records.map((r) => r.id)).toEqual(['a1']);
  });
});
