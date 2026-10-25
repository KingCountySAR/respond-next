/**
 * End-to-end check against a running server with DEV_TOOLS=true (npm run dev, or a build run with
 * it set): a manage and a respond client over real WebSockets, one change each way.
 * Each signs in with the dev sign-in and connects with its session cookie. The respond client is a
 * member of the dev seed (SMOKE_RESPOND_EMAIL to use another).
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

const manage = await makeClient({ email: 'smoke-manager@example.org', name: 'Smoke Manager', tier: 'manage', class: 'member' });
const respond = await makeClient({ email: process.env.SMOKE_RESPOND_EMAIL ?? 'bo.okafor@crt.example.org', tier: 'respond', class: 'member' });
const bobRef = asActivityViewer(respond.viewer).personRef!;
for (const c of [manage, respond]) {
  await c.start();
  await c.open(activityId);
}
await waitFor('both clients live', () => manage.status.state === 'live' && respond.status.state === 'live');

const bob = participantIdFor(bobRef);
const t0 = Date.now();
manage.mutate(activityId, 'createActivity', {
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
manage.mutate(activityId, 'addComm', { id: 'smoke-comm', from: 'Base', to: 'All', message: 'Managers only' });
manage.mutate(activityId, 'addParticipant', { personRef: bobRef, firstname: 'Bob', lastname: 'Brown', unit: CRT, status: 'responding', at: manage.now() - 30 * 60_000 });
manage.mutate(activityId, 'setMiles', { participantId: bob, miles: 42 });
await waitFor('respond client sees Bob', () => respond.snapshot(activityId).get<ParticipantRec>('participant', bob)?.firstname === 'Bob');
console.log(`respond client saw the new person after ${Date.now() - t0} ms`);
await waitFor("respond client sees Bob's miles", () => respond.snapshot(activityId).get<ParticipantRec>('participant', bob)?.miles === 42);
// The comm went before Bob, and messages arrive in order, so it would be here by now if it leaked.
if (respond.snapshot(activityId).get('comm', 'smoke-comm')) throw new Error('respond client received a manager-only comm');

respond.mutate(activityId, 'setParticipantStatus', { participantId: bob, status: 'staging', unit: CRT, at: respond.now() - 15 * 60_000 });
await waitFor('manager client sees the backdated status', () => currentParticipantStatus(manage.snapshot(activityId), bob)?.status === 'staging');
await waitFor('all pending confirmed', () => manage.status.pending === 0 && respond.status.pending === 0);
const s = currentParticipantStatus(manage.snapshot(activityId), bob)!;
console.log(`manager client sees Bob '${s.status}' since ${Math.round((manage.now() - s.at) / 60_000)} min ago; miles ${manage.snapshot(activityId).get<ParticipantRec>('participant', bob)?.miles}`);

manage.stop();
respond.stop();
console.log('smoke test passed');
