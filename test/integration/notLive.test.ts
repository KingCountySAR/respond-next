import { afterEach, describe, expect, it } from 'vitest';
import { MemoryPersistence, SyncClient, type ActivityDownload } from '@sync/client';
import type { ActivityClient } from '@sync/model';
import { Hub, MemoryStorage } from '@sync/server';
import { activityProjector, activityRegistry, getActivity, type ActivityViewer } from '@sync/domain';
import { COMMAND, activityArgs } from '../../packages/domain/__tests__/helpers';
import { SimNetwork, mulberry32 } from './sim';

const SECOND_COMMAND: ActivityViewer = { ...COMMAND, userId: 'u-command-2' };

async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(check()).toBe(true);
}

const clients: ActivityClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.stop()));

/** A closed activity made by one command client, and a second client to open it, not live. */
async function setup(download?: (hub: Hub) => (activityId: string) => Promise<ActivityDownload>) {
  const hub = new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: Date.now });
  const net = new SimNetwork(hub, mulberry32(3));
  net.latencyMs = 10;
  const author = new SyncClient({ registry: activityRegistry, viewer: COMMAND, transport: net.transportFor(0, COMMAND) });
  await author.start();
  await author.open('a1');
  author.mutate('a1', 'createActivity', activityArgs());
  author.mutate('a1', 'closeActivity', {});
  await until(() => author.snapshot('a1').version === 2 && author.status.pending === 0);

  const persistence = new MemoryPersistence();
  const reader = new SyncClient({
    registry: activityRegistry,
    viewer: SECOND_COMMAND,
    transport: net.transportFor(1, SECOND_COMMAND),
    persistence,
    download: download?.(hub) ?? ((activityId) => hub.read(activityId, SECOND_COMMAND)),
  });
  await reader.start();
  clients.push(author, reader);
  const subscribers = async () => (await hub.actor('a1')).subscriberCount;
  const title = () => getActivity(reader.snapshot('a1'))?.title;
  return { hub, net, author, reader, persistence, subscribers, title };
}

describe('activities opened not live', () => {
  it('are read once, without subscribing or being kept offline', async () => {
    const s = await setup();
    await s.reader.open('a1', { live: false });
    await until(() => s.title() === 'Lost hiker, Mailbox Peak');
    expect(s.reader.isLive('a1')).toBe(false);
    expect(await s.subscribers()).toBe(1); // the author only

    s.author.mutate('a1', 'reopenActivity', {});
    s.author.mutate('a1', 'updateActivity', { title: 'Renamed' });
    await until(() => s.author.status.pending === 0);
    await new Promise((r) => setTimeout(r, 100));
    expect(s.title()).toBe('Lost hiker, Mailbox Peak');
    await new Promise((r) => setTimeout(r, 300)); // past the persist delay
    expect(await s.persistence.loadActivity('a1')).toBeUndefined();
  });

  it('go live from the version they read, and are kept offline from then', async () => {
    const s = await setup();
    await s.reader.open('a1', { live: false });
    await until(() => s.title() === 'Lost hiker, Mailbox Peak');
    s.author.mutate('a1', 'reopenActivity', {});
    s.author.mutate('a1', 'updateActivity', { title: 'Renamed' });
    await until(() => s.author.status.pending === 0);

    s.reader.goLive('a1');
    await until(() => s.title() === 'Renamed');
    expect(await s.subscribers()).toBe(2);
    await new Promise((r) => setTimeout(r, 300));
    expect((await s.persistence.loadActivity('a1'))?.version).toBe(4);
  });

  it('go live when a change is made to them', async () => {
    const s = await setup();
    await s.reader.open('a1', { live: false });
    await until(() => s.title() === 'Lost hiker, Mailbox Peak');
    s.reader.mutate('a1', 'reopenActivity', {});
    expect(s.reader.isLive('a1')).toBe(true);
    await until(() => getActivity(s.author.snapshot('a1'))?.closed === false);
  });

  it('say an activity the server lacks is missing', async () => {
    const s = await setup();
    await s.reader.open('nothing', { live: false });
    await until(() => s.reader.missing('nothing'));
  });

  it("try the read again once connected, if it couldn't reach the server", async () => {
    let failures = 1;
    const s = await setup((hub) => async (activityId) => {
      if (failures-- > 0) throw new Error('offline');
      return hub.read(activityId, SECOND_COMMAND);
    });
    s.net.cut(1);
    await s.reader.open('a1', { live: false });
    await new Promise((r) => setTimeout(r, 50));
    expect(s.title()).toBeUndefined();
    s.net.restore(1);
    s.reader.kick();
    await until(() => s.title() === 'Lost hiker, Mailbox Peak');
    expect(s.reader.isLive('a1')).toBe(false);
  });
});
