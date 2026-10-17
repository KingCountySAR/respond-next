import { describe, expect, it } from 'vitest';
import { SyncClient, type Transport } from '@sync/client';
import { testRegistry } from '../../sync-core/__tests__/testDomain';

function countingClient() {
  const opened: Transport[] = [];
  const client = new SyncClient({
    registry: testRegistry,
    viewer: { userId: 'u1', tier: 'command' },
    transport: () => {
      const t: Transport = { open() {}, send() {}, close() {} };
      opened.push(t);
      return t;
    },
  });
  return { client, opened };
}

describe('start and stop', () => {
  it('stays stopped when stop() lands while start() is still loading', async () => {
    const { client, opened } = countingClient();
    const starting = client.start();
    client.stop();
    await starting;
    expect(opened).toHaveLength(0);
  });

  it('connects once through a StrictMode-style start, stop, start', async () => {
    const { client, opened } = countingClient();
    const first = client.start();
    client.stop();
    const second = client.start();
    await Promise.all([first, second]);
    expect(opened).toHaveLength(1);
    client.stop();
  });
});
