/**
 * End-to-end check against a running server (npm run dev, npm run start or Docker):
 * a command and a field client over real WebSockets, one change each way.
 * Usage: npm run smoke [-- ws://host:port/api/sync]
 */
import { SyncClient, WebSocketTransport } from '@sync/client';
import { randomId } from '@sync/core';
import { currentStatus, toyRegistry, type Person } from '@sync/toy-domain';

const base = process.argv[2] ?? 'ws://localhost:4000/api/sync';
const eventId = `smoke-${Date.now()}`;

const makeClient = (user: string, tier: string) =>
  new SyncClient({ registry: toyRegistry, viewer: { userId: user, tier }, transport: () => new WebSocketTransport(`${base}?user=${user}&tier=${tier}`) });

async function waitFor(what: string, check: () => boolean, ms = 5000): Promise<void> {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

const command = makeClient('alice', 'command');
const field = makeClient('bob', 'field');
for (const c of [command, field]) {
  await c.start();
  await c.open(eventId);
}
await waitFor('both clients live', () => command.status.state === 'live' && field.status.state === 'live');

const id = randomId();
const t0 = Date.now();
command.mutate(eventId, 'addPerson', { id, name: 'Anna' });
command.mutate(eventId, 'setNote', { id, note: 'has the radio' });
await waitFor('field client sees Anna', () => field.snapshot(eventId).get<Person>('person', id)?.name === 'Anna');
console.log(`field client saw the new person after ${Date.now() - t0} ms`);
if ('note' in (field.snapshot(eventId).get('person', id) ?? {})) throw new Error('field client received the command-only note');

field.mutate(eventId, 'setStatus', { personId: id, status: 'assigned', at: field.now() - 15 * 60_000 });
await waitFor('command client sees the backdated status', () => currentStatus(command.snapshot(eventId), id)?.status === 'assigned');
await waitFor('all pending confirmed', () => command.status.pending === 0 && field.status.pending === 0);
const s = currentStatus(command.snapshot(eventId), id)!;
console.log(`command client sees status '${s.status}' at ${Math.round((command.now() - s.at) / 60_000)} min ago; note '${command.snapshot(eventId).get<Person>('person', id)?.note}'`);

command.stop();
field.stop();
console.log('smoke test passed');
