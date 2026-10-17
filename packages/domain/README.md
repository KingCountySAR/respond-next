# @sync/domain

The mission model: the records an event is made of, the queries that read them, the mutations that change them, and the projector that decides what each viewer may see. The same code runs in the browser (optimistic apply) and on the server (the real apply), so a mutation's result is identical on both.

> **Not wired in yet.** `server/src/main.ts` and the harness still use `@sync/toy-domain`. To run against this package, pass `missionRegistry` and `missionProjector` to the `Hub` and `missionRegistry` to each `SyncClient`.

## What's in it

| File | What it holds |
| --- | --- |
| `src/schema.ts` | Record interfaces (`EventRec`, `ParticipantRec`, `ParticipantStatusRec`, `AssignmentRec`, `TeamRec`, ...), status lists, `Target`, `DEFAULT_PLACES` |
| `src/queries.ts` | Pure reads over a `ReadView`: current status, unit, assignment, team members, counts, event phase |
| `src/statusSteps.ts` | The status buttons offered from each status, standby-only and light-mode rules |
| `src/equipment.ts` | The equipment catalogue (legacy ids `inventory-0..38`) |
| `src/viewer.ts` | `MissionViewer` (tier, class, personRef), `isCommand`, `SYSTEM_VIEWER` |
| `src/mutations/*.ts` | Every mutation, grouped by event, participants and operations; `common.ts` has shared checks and helpers |
| `src/projector.ts` | `missionProjector`: field views per record type |
| `src/index.ts` | Exports all of the above, plus `missionMutations` and `missionRegistry` |

An event is a flat set of records, each `{ type, id, version, ...fields }`. There is one `event` record (id `EVENT_RECORD_ID`). Things that change over time (participant status, assignment, team status, unit status) are not fields on the thing; they are separate timed entries with an `at`. The current value is the latest entry, which is what the queries work out for you.

## Getting a view of an event

A client holds a **snapshot** of each event it has open: the server's confirmed records with this client's pending mutations applied on top. A snapshot is a `ReadView` (`get(type, id)`, `scan(type)`), and every query in this package takes a `ReadView`.

```ts
import { SyncClient, WebSocketTransport, IndexedDbPersistence } from '@sync/client';
import { missionRegistry, type MissionViewer } from '@sync/domain';

const viewer: MissionViewer = { userId: 'u-123', tier: 'command', class: 'member', personRef: 'kcsara:85205' };

const client = new SyncClient({
  registry: missionRegistry,
  viewer, // used for local checks only; the server decides from the session
  transport: () => new WebSocketTransport('wss://example.org/api/sync'),
  persistence: new IndexedDbPersistence(),
});
await client.start();
await client.open(eventId); // subscribes; works offline from what's persisted

const snap = client.snapshot(eventId);
```

Then read it with the queries rather than scanning records by hand:

```ts
import { getEvent, eventPhase, statusOf, currentTarget, targetName, teamMembers, statusCounts, type ParticipantRec, type TeamRec } from '@sync/domain';

const event = getEvent(snap);                    // EventRec | undefined
const phase = event && eventPhase(event, client.now());
const people = [...snap.scan<ParticipantRec>('participant')];
for (const p of people) {
  console.log(p.firstname, statusOf(snap, p.id), targetName(snap, currentTarget(snap, p.id)));
}
const team = snap.get<TeamRec>('team', teamId);
const members = teamMembers(snap, teamId);
const counts = statusCounts(snap);              // { standby: 3, staging: 5, ... }
```

Things to know:

- **Use `client.now()`, never `Date.now()`,** for "now" and "minutes ago". It is the server's clock as corrected by the client.
- **Most timed queries take `asOf`.** `statusOf(snap, id, asOf)`, `teamMembers(snap, teamId, asOf)` and the rest answer "as of then", for reports and timelines.
- **A field viewer's snapshot holds projected records.** A field member sees only the fields in `src/projector.ts`: no `miles` on participants, no `comm` records, assignments with only `{ kind }` as their target. Write UI that copes with a field being absent, and read `missionProjector` to see what's there.
- **Pending changes are marked.** `snap.pending` lists this client's unconfirmed mutations and `snap.pendingKeys` the `type/id` keys they touched, for "not synced yet" markers. `client.describe(eventId, m)` gives each one's text.

In React, `@sync/client/react` re-renders on change:

```tsx
import { useEventSnapshot, useSyncStatus, useRejections } from '@sync/client/react';

function TeamList({ client, eventId }: { client: SyncClient; eventId: string }) {
  const snap = useEventSnapshot(client, eventId); // the event must already be open
  const teams = [...snap.scan<TeamRec>('team')];
  return <ul>{teams.map((t) => <li key={t.id}>{t.name} ({teamMembers(snap, t.id).length})</li>)}</ul>;
}
```

`useSyncStatus` gives connection state and the pending count; `useRejections` the latest changes the server refused.

## Making an update

Call `client.mutate(eventId, name, args)`. It checks the change, applies it to the snapshot at once, queues it, and sends it when connected. The server runs the same mutation; if it refuses, the client drops it from the snapshot and reports a rejection.

```ts
import { Rejection, randomId } from '@sync/core';

try {
  const teamId = randomId();
  client.mutate(eventId, 'createTeam', { id: teamId, name: 'Team 4' });
  client.mutate(eventId, 'assign', { participantId, target: { kind: 'team', id: teamId }, asLeader: true });
  client.mutate(eventId, 'setParticipantStatus', { participantId, unit, status: 'demobilizing', at: backdatedTime });
} catch (err) {
  if (err instanceof Rejection) showError(err.message); // refused locally: nothing was queued
  else throw err;
}

client.onReject((r) => showError(r.message)); // refused later by the server
```

- **Names and args** are in `src/mutations/*.ts`; each mutation's `args` zod schema is the contract. Bad args throw `Rejection('bad_args')` before anything is queued.
- **`at` is optional on timed mutations** (`timed: true`): leave it out and the client fills in `client.now()`. Pass it to backdate ("signed in at 07:40").
- **Records you create need an id from the caller** (`createTeam`, `createPlace`, `addComm`, ...): use `randomId()`. Follow-on records a mutation makes itself (status entries, assignments) get deterministic ids from `ctx.newId()`. Participants are the exception: their id is `participantIdFor(personRef)`, so two devices adding the same person agree.
- **Permissions:** `allow` on each mutation says which viewers may call it (most operations are command only); `run` adds finer rules, such as field users only changing themselves. Both run on the client too, so you can hide a button the server would refuse. To ask without applying, check `missionRegistry.latest(name)?.allow?.(viewer)`.
- **Light mode and closed events** refuse most changes with `light_mode` or `closed`. `hasOperations(event)` tells you whether to show teams, places and equipment at all.

On the server, the system acts as `SYSTEM_VIEWER` (for example `setMemberInfo` after a member lookup).

## Adding a mutation

Say command needs to record a team's radio callsign.

**1. Add the field to the record** in `src/schema.ts`. Make it optional: teams created before the change don't have it.

```ts
export interface TeamRec extends Rec {
  // ...
  callsign?: string | null;
}
```

**2. Define the mutation** next to its neighbours, here in `src/mutations/operations.ts`:

```ts
export const setTeamCallsign = defineMutation({
  name: 'setTeamCallsign',
  version: 1,
  args: z.object({ teamId: id, callsign: optionalText }),
  allow: isCommand,
  describe: (a, view) => `Set ${nameOf(view, 'team', a.teamId)} callsign to ${a.callsign ?? 'none'}`,
  run(tx, a) {
    requireOperations(tx);
    requireRec(tx, 'team', a.teamId);
    tx.update('team', a.teamId, { callsign: a.callsign || null });
  },
});
```

It's exported from the file, so `index.ts` picks it up in `missionMutations` and `missionRegistry` with no further change.

**3. Decide who sees it** in `src/projector.ts`. Field members see only `name` on teams today; add `callsign` to their `team` rule if they should see it. A **new record type** is hidden from field views until you add a rule for it, so forgetting fails safe.

**4. Test it** in `__tests__/`, with the `TestEvent` harness from `__tests__/helpers.ts`. It applies mutations with the server's rules, without a network:

```ts
it('sets and clears a callsign, command only', () => {
  const e = startedEvent();
  e.run('createTeam', { id: 't1', name: 'Team 1' });
  e.run('setTeamCallsign', { teamId: 't1', callsign: 'Rescue 4' });
  expect(e.get<TeamRec>('team', 't1')?.callsign).toBe('Rescue 4');
  expect(e.rejects('setTeamCallsign', { teamId: 't1', callsign: null }, fieldMember('kcsara:1'))).toBe('forbidden');
});
```

### Rules for `run`

- **Deterministic.** The client and the server must produce the same writes from the same records. Never call `Date.now()`, `Math.random()` or `randomId()` inside `run`: time comes from `args.at`, ids from `args` or `ctx.newId(n)` (or `idSource(ctx)` when you make several).
- **Read through `tx`,** never from outside: `tx` sees the writes made so far in this mutation. Queries take `tx` as their view.
- **Prefer `tx.update` over `tx.put` for edits.** A field client holds only the projected record, so a `put` built from what it can see would wipe hidden fields.
- **Refuse with `throw new Rejection(code, message)`.** The message is shown to the person. The checks in `mutations/common.ts` (`requireOpen`, `requireOperations`, `requireParticipant`, `requireSelfOrCommand`, `requireTarget`) cover the usual cases.
- **Follow-on changes go in the same mutation**, so they apply atomically: moving someone via `moveParticipant` also flips their status and clears a team leader. Reuse the helpers in `common.ts` rather than writing assignment or status records directly.
- **`describe` is user-facing text** for pending markers, rejection notices and reports. Write it as a sentence about what changed.
- **Timed mutations** set `timed: true` and take `at` in their args.

### Changing a mutation that has shipped

Clients can hold queued mutations for a while (offline in the field), so a server must keep accepting what older clients send. Don't change a shipped mutation's args incompatibly. Instead define the same `name` with `version: 2` and keep version 1 in the registry. New clients send the latest version; the server looks each mutation up by name and version. Adding an optional arg with a default is compatible and needs no new version. Remove an old version only once no client can still have it queued.
