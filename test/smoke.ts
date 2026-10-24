/**
 * End-to-end check against a running server with DEV_TOOLS=true (npm run dev, or a build run with
 * it set): a command and a field client over real WebSockets, one change each way.
 * Each signs in with the dev sign-in and connects with its session cookie. The field client is a
 * member of the dev seed (SMOKE_FIELD_EMAIL to use another).
 * Usage: npm run smoke [-- ws://host:port/api/sync]
 */
import { SyncClient, WebSocketTransport } from '@sync/client';
import type { ActivityClient } from '@sync/model';
import { activityRegistry, asActivityViewer, currentParticipantStatus, participantIdFor, viewerOfSession, type DevSignInRequest, type ParticipantRec, type SessionResponse } from '@sync/domain';

const base = process.argv[2] ?? 'ws://localhost:4000/api/sync';
const activityId = `smoke-${Date.now()}`;
const CRT = { id: 'org-crt', title: 'Cascade Rescue Team', rosterName: 'CRT' };

async function makeClient(request: DevSignInRequest): Promise<ActivityClient> {
  const res = await fetch(new URL('/api/auth/dev', base.replace(/^ws/, 'http')), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  if (!res.ok) throw new Error(`sign-in as ${request.email}: HTTP ${res.status} ${await res.text()}`);
  const { session } = (await res.json()) as SessionResponse;
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
  return new SyncClient({ registry: activityRegistry, viewer: viewerOfSession(session!), transport: () => new WebSocketTransport(base, { headers: { cookie } }) });
}

async function waitFor(what: string, check: () => boolean, ms = 5000): Promise<void> {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

const command = await makeClient({ email: 'smoke-command@example.org', name: 'Smoke Command', tier: 'command', class: 'member' });
const field = await makeClient({ email: process.env.SMOKE_FIELD_EMAIL ?? 'bo.okafor@crt.example.org', tier: 'field', class: 'member' });
const bobRef = asActivityViewer(field.viewer).personRef!;
for (const c of [command, field]) {
  await c.start();
  await c.open(activityId);
}
await waitFor('both clients live', () => command.status.state === 'live' && field.status.state === 'live');

const bob = participantIdFor(bobRef);
const t0 = Date.now();
command.mutate(activityId, 'createActivity', {
  idNumber: '',
  kind: 'mission',
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
command.mutate(activityId, 'addParticipant', { personRef: bobRef, firstname: 'Bob', lastname: 'Brown', unit: CRT, status: 'responding', at: command.now() - 30 * 60_000 });
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
