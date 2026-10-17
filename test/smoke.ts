/**
 * End-to-end check against a running server (npm run dev, npm run start or Docker):
 * a command and a field client over real WebSockets, one change each way.
 * Usage: npm run smoke [-- ws://host:port/api/sync]
 */
import { SyncClient, WebSocketTransport } from '@sync/client';
import { activityRegistry, currentParticipantStatus, participantIdFor, type ActivityViewer, type ParticipantRec } from '@sync/domain';

const base = process.argv[2] ?? 'ws://localhost:4000/api/sync';
const activityId = `smoke-${Date.now()}`;
const CRT = { id: 'org-crt', title: 'Cascade Rescue Team', rosterName: 'CRT' };

function makeClient(viewer: ActivityViewer): SyncClient {
  const query = new URLSearchParams({ user: viewer.userId, tier: viewer.tier, class: viewer.class, ...(viewer.personRef && { person: viewer.personRef }) });
  return new SyncClient({ registry: activityRegistry, viewer, transport: () => new WebSocketTransport(`${base}?${query}`) });
}

async function waitFor(what: string, check: () => boolean, ms = 5000): Promise<void> {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

const command = makeClient({ userId: 'alice', tier: 'command', class: 'member', personRef: 'kcsara:101' });
const field = makeClient({ userId: 'bob', tier: 'field', class: 'member', personRef: 'kcsara:102' });
for (const c of [command, field]) {
  await c.start();
  await c.open(activityId);
}
await waitFor('both clients live', () => command.status.state === 'live' && field.status.state === 'live');

const bob = participantIdFor('kcsara:102');
const t0 = Date.now();
command.mutate(activityId, 'createActivity', {
  idNumber: '',
  kind: 'training',
  title: 'Smoke test',
  description: '',
  location: { title: 'Nowhere', lat: null, lon: null, address: null },
  mapId: '',
  startTime: Date.now(),
  ownerOrgId: CRT.id,
  mode: 'full',
  standbyOnly: false,
});
command.mutate(activityId, 'addComm', { id: 'smoke-comm', from: 'Base', to: 'All', message: 'Command only' });
command.mutate(activityId, 'addParticipant', { personRef: 'kcsara:102', firstname: 'Bob', lastname: 'Brown', unit: CRT, status: 'responding', at: command.now() - 30 * 60_000 });
command.mutate(activityId, 'setMiles', { participantId: bob, miles: 42 });
await waitFor('field client sees Bob', () => field.snapshot(activityId).get<ParticipantRec>('participant', bob)?.firstname === 'Bob');
console.log(`field client saw the new person after ${Date.now() - t0} ms`);
await waitFor("field client sees Bob's miles", () => field.snapshot(activityId).get<ParticipantRec>('participant', bob)?.miles === 42);
// The comm went before Bob, and messages arrive in order, so it would be here by now if it leaked.
if (field.snapshot(activityId).get('comm', 'smoke-comm')) throw new Error('field client received a command-only comm');

field.mutate(activityId, 'setParticipantStatus', { participantId: bob, status: 'staging', unit: CRT, at: field.now() - 15 * 60_000 });
await waitFor('command client sees the backdated status', () => currentParticipantStatus(command.snapshot(activityId), bob)?.status === 'staging');
await waitFor('all pending confirmed', () => command.status.pending === 0 && field.status.pending === 0);
const s = currentParticipantStatus(command.snapshot(activityId), bob)!;
console.log(`command client sees Bob '${s.status}' since ${Math.round((command.now() - s.at) / 60_000)} min ago; miles ${command.snapshot(activityId).get<ParticipantRec>('participant', bob)?.miles}`);

command.stop();
field.stop();
console.log('smoke test passed');
