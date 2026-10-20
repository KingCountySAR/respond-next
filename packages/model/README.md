# @sync/model (prototype)

Readable, observable objects over one activity, for the UI:

```tsx
const Roster = observer(() => {
  const activity = useFieldActivity();
  return (
    <>
      <h2>{activity.record?.title} ({activity.phase})</h2>
      <ul>{activity.participants.map((p) => <Card key={p.id} p={p} />)}</ul>
    </>
  );
});

const Card = observer(({ p }: { p: FieldParticipant }) => (
  <li className={p.isPending ? 'unsynced' : ''}>
    {p.name}: {p.status}
    {p.isMe && <button onClick={() => p.setStatus('demobilizing')}>Demob</button>}
  </li>
));
```

When Ben's status changes, only Ben's `Card` re-renders: not Anna's, not the list.

## How it works

```
SyncClient snapshot ──apply──▶ RecordStore (MobX observables, a ReadView)
                                   ▲
       domain queries (statusOf, teamMembers, activityPhase…) read it
                                   ▲
       FieldActivity ◀─extends─ CommandActivity (and FieldParticipant ◀─ CommandParticipant, FieldTeam ◀─ CommandTeam, ...)
                                   ▲
       observer() components read the models
```

- **`RecordStore`** holds the activity's records in MobX observable maps, one per type. On each new client snapshot it writes only the records that changed. Records the change didn't touch keep their object, and pending ones that come back equal are skipped. It implements `ReadView`, so the domain queries run over it unchanged, and MobX records which records each query read.
- **Indexes.** The store also keeps the lookups in `ACTIVITY_INDEXES` (from `@sync/domain`), such as status entries by participant. Queries use them through `scanWhere`, so Anna's `status` depends on Anna's entries only. Without them, every status computation would depend on every status entry in the activity.
- **Models** come in two levels, because the views nest. `FieldActivity`, `FieldParticipant`, `FieldTeam` and the rest are what every viewer can read and do. `CommandActivity`, `CommandParticipant`, `CommandTeam` and the rest extend them with what only command sees (full targets, team members and details, comms) and does (assign, team status, every operations change). `createActivityModel(client, activityId)` picks the level from the client's viewer: command and support get `CommandActivity`. `CommandActivity.participants` is typed `CommandParticipant[]`, and `CommandTeam.group` a `CommandGroup`, through one `Kinds` type parameter that every model takes, not by overriding getters, which MobX doesn't allow for computeds.
- **Field record types come from the projector.** `FieldParticipantRec` and the rest are derived in `@sync/domain` from the same field lists the server projects with, so they can't drift. Fields members get are optional, because external people don't get them (`personRef`, `eta`). Command-only fields are absent: `team.record.notes` on a `FieldTeam` doesn't compile.
- **Model classes** have `computed` getters that call the domain queries. There's no second copy of any rule. Each model is cached by id, so the same person is the same object, and list getters return the same array when membership and order haven't changed.
- **`Clock`** is the server's time as an observable. It only ticks while something observes it, so `activity.phase` moves on without a timer running on idle screens.
- **Writes** call `client.mutate`. The client applies the change and notifies synchronously, so the model shows it on the next read. Nothing writes the observables except `apply`.

## Using it

Without React (tests, scripts, a worker):

```ts
await client.open(activityId);
const activity = createActivityModel(client, activityId); // or new CommandActivity / new FieldActivity
activity.participants[0]?.status;
reaction(() => activity.statusCounts.assigned, (n) => console.log(n, 'assigned'));
activity.dispose(); // stops following the client; doesn't close the activity
```

With React, `ActivityModelProvider` opens the activity, shares one model per client and activity, and closes it when the last provider unmounts. Remounts in the same tick, as under StrictMode, keep it open. With `live={false}` it opens the activity not live (`client.open(id, { live: false })`: read once with the client's `download`, not subscribed to or kept offline), and makes it live when `live` turns true; a change made to it makes it live too.

```tsx
import { ActivityModelProvider, observer, useCommandActivity, useFieldActivity } from '@sync/model/react';

<ActivityModelProvider client={client} activityId={activityId} fallback={<Spinner />}>
  <Roster />
</ActivityModelProvider>
```

Field screens call `useFieldActivity()`, which works for every viewer, so command can open field screens too. Command screens call `useCommandActivity()`, which throws for field viewers. A client's viewer is fixed for its life; a different user or tier means a new client, and so a new model.

Only components wrapped in `observer` react. A component that reads the model without `observer` renders once and goes stale.

## What's here and what isn't

- **Models.** Every model has `record`, `id`, `activity` and `isPending`.

  | Field level (every viewer) | Command level adds |
  | --- | --- |
  | `FieldActivity`: phase, hasOperations, participants, me, teams, groups, places, units, equipment, statusCounts, canSeeAssignments, addParticipant, mutate | `CommandActivity`: comms, update, close, reopen, remove, setUnitStatus, createTeam, createGroup, createPlace, addEquipment, logComm |
  | `FieldParticipant`: name, status, unit, timeline, contact, targetKind, isMe, setStatus, setEta, setMiles | `CommandParticipant`: target, locationName, team, assign, correctStatus, setActivityTags, linkPerson |
  | `FieldTeam`: name, asTarget | `CommandTeam`: status, gar, assignment, notes, members, leader, group, equipment, update, setStatus, setLeader, moveToGroup, disband, delete |
  | `FieldGroup`: name, leader (members only), asTarget | `CommandGroup`: teams, members, equipment, rename, setLeader, delete |
  | `FieldPlace`: name, isBase, asTarget | `CommandPlace`: lat, lon, notes, members, equipment, update, delete |
  | `FieldUnit`: name, title, status, statusCounts | `CommandUnit`: setStatus |
  | `FieldEquipment`: name, category, assignedTo, locationName | `CommandEquipment`: assign |
  | | `Comm` (command only): from, to, message, at, favorite, automated, edit, setFavorite, delete |

  The `create...` methods return the new model, which is there at once because the client applies changes synchronously. Teams, groups and places have `asTarget` for the methods that take a `Target` (`p.assign(team.asTarget)`, `team.disband(base.asTarget)`).
- **The activity list.** `ActivityList` reads the list scope: `activities` (one `ActivityListItem` per summary, with `phase`, `isActive`, `startsInFuture`, `activeParticipantCount`, `units` and `statusOf(participantId)`). In React, `useActivityList(client)` opens it while a component uses it, with the same sharing and lifetime as `ActivityModelProvider`.
- **Files.** `src/models/` has one file per model, each holding its field and command classes (`team.ts` has `FieldTeam` and `CommandTeam`). `activity.ts` has both activity classes and `createActivityModel`, `kinds.ts` the `Kinds` types, and `record.ts` the base class and helpers they share. Only `activity.ts` imports the model classes at runtime; the rest import each other for types only, so there are no import cycles.
- **Not in the model:** screen state such as the comms log's favourites and automated filters, its search, and the suggested from/to names. Those belong to the screen.
- **External people** see no assignments, so `targetKind` is `undefined` for them ("can't see"), not `null` ("unassigned"). They find themselves through `me`, by the participant id derived from their person ref.
- **Cost.** `apply` walks the whole snapshot on every change, as the snapshot rebuild already does. That's fine for an activity's few thousand records; if it shows up in profiles, the client could hand over the changed keys instead.
- **`members` and `equipment`** on teams, groups and places still depend on all assignments (or all equipment), because "who's here" means everyone's current assignment. They recompute on any such change but only re-render when the list changes.

## Tests

- `__tests__/store.test.ts`, `__tests__/model.test.ts` and `__tests__/operations.test.ts` (teams, groups, places, units, equipment, comms) run in plain vitest against an offline `SyncClient`, with no React and no DOM. They count reaction runs to prove that readers only wake for what they read.
- `__tests__/react.test.tsx` (jsdom) checks render counts per card, the StrictMode open/close behaviour, and that `useCommandActivity` refuses field viewers.
- Type tests (`expectTypeOf`, `@ts-expect-error`) in `model.test.ts` and `operations.test.ts` run under `npm run typecheck`: showing a command-only field to field viewers breaks the build.
- `test/integration/model.test.ts` runs command, member and external clients through the real activity actor: confirmation clears `isPending`, other clients see changes, each field viewer gets its projection and its `me`, and field viewers get place names, equipment and unit status but no comms, place notes or (for external people) group leaders.
