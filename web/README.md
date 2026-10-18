# web

The app people use. It replaces respond-next's client, keeping its URLs and, page by page, its DOM. The legacy app's components move over with their JSX; what changes is where they read data (the `@sync/model` models) and how they act (model methods, which call `client.mutate`).

## Layout

| Path | What it holds |
| --- | --- |
| `src/shell/App.tsx` | Loads `/api/bootstrap`, themes the app, gates it behind sign-in, starts the session's SyncClient, renders the routes. `useSite()` gives the site config |
| `src/shell/auth.tsx` | The session (`useAuth()`): who is signed in, `signIn`, `signOut` |
| `src/shell/sync.tsx` | One `SyncClient` per session (`useSyncClient()`), kept offline-ready in IndexedDB, one store per user and tier |
| `src/shell/ActivityLayout.tsx` | Opens an activity for the pages under it; they read it with `useFieldActivity()` or `useCommandActivity()` |
| `src/shell/ToolbarPage.tsx`, `AppMenu.tsx` | The legacy page frame: app bar with title, connection icon and account menu |
| `src/shell/routes.tsx` | The legacy URLs: `/`, `/mission/*`, `/event/*`, `/ops/:id`, `/reports/*`, `/admin/*` |
| `src/sections/field` | Home (My Activity, Missions, Events, from the activity list; each active tile has its status button) and the activity page (`/mission/:id`, `/event/:id`): desktop and mobile layouts, briefing and manager panels, unit chips, roster with the participant dialog, the status button and its confirm form, ETA and miles. New and Edit (`/mission/new`, `/mission/:id/edit`, and the event ones) with the location picker and dialog. Loads with the shell |
| `src/sections/reports` | The Mission List and Event List (`/reports/missions`, `/reports/events`): a data grid of the activity list. The roster report (`/reports/roster/:id`): a row per stint from each person's status timeline (`rosterEntries.ts`; someone added straight to staging or an assignment starts a stint there, that time standing in for the sign in), with standby rows, last-name-first, column borders, CSV download and print. Loads the first time its route is visited |
| `src/sections/ops`, `admin` | Load the first time their route is visited |
| `src/ui` | Shared components with no data of their own, mostly the legacy ones as they were (`OutputForm`, `SplitButton`, `RelativeTimeText`, ...), and `status.ts`: the legacy words and colours for each status |
| `src/shell/dialogs`, `preferences.tsx` | The legacy dialog provider (`useDialogs()`: `open`, `confirm`, `alert`) and per-device preferences |

## Rules

- **Sections don't import each other.** Each may use the shell, `ui`, its own files and the packages. The shell imports a section only through its `index.ts`. `__tests__/boundaries.test.ts` checks both, until ESLint's boundary rules are set up.
- **Read through the models,** inside `observer(...)`. A component that reads the model without `observer` renders once and goes stale.
- **Use `activity.clock` or `client.now()` for "now",** never `Date.now()`: it's the server's clock.

## Sign-in for now

There is no Google sign-in until phase 2. The login panel's offline path asks who you are (name, person ref, tier, class) and keeps it in `localStorage`. The SyncClient sends it on the WebSocket URL, which is the server's dev auth. Phase 2 replaces this with Google sign-in and a session cookie, and the tier comes from each activity's grants instead.

## Not here yet

- **Home, the activity page, New/Edit activity and the reports are ported; the rest are placeholders** that say which step ports them: the ops dashboard, admin.
- **New/Edit activity has no saved-location catalog yet:** the location choices are the locations of listed activities, and the location dialog edits this activity's location only (no "Create Saved Location", no map preview). There's no warning when someone else is drafting the same new activity (the legacy app used presence). A new event is a training; editing keeps an existing event's kind. A partner that owns a new activity is listed as invited.
- **Add Responder** searches the server's member directory, which is a fixture for now (see the root README); the real directories need the network and credentials.
- **Member photos** come from `/api/v1/organizations/<unit>/members/<id>/photo`, which is 404 until a directory has photos, so the participant dialog shows a broken image.
- **Home and the lists show every activity to everyone,** until grants. New Mission and New Event show for command and support when the organization or a partner may create that kind (from the site config until organizations are stored).
- **No "Activity not found".** The client can't yet tell an activity the server doesn't have from one that hasn't synced, so `ActivityLayout` shows "Loading activity..." until the record arrives.
- **Not yet ported:** the per-organization manifest and icons (`/api/manifest.webmanifest`, `/api/icon/*`).

## Tests

`__tests__/app.tsx` renders the whole app in jsdom against the real activity actor over the simulated network, with a command client that set the activity up and the server's summary writer running. `shell.test.tsx` covers sign-in, the connection icon, the ops guard, a legacy redirect and sign-out; `field.test.tsx` the activity page: briefing, units, roster, changing your own status (and command seeing it), signing in from the status button, the participant dialog, and a refused Complete. `home.test.tsx` covers Home: My Activity, missions and events from the summaries, changing status from a tile, and a new activity appearing without a refresh. `activityList.test.tsx` covers the Mission and Event Lists and the legacy `/mission` redirect to them. `addParticipant.test.tsx` covers Add Responder: signing in a member from the directory under the unit picked, someone already on the activity, the first-responder warning for a partner, and a field member refused. `activityDraft.test.ts` covers the form's rules (`activityDraft.ts`: owners per type, validation, what saving sends); `activityEdit.test.tsx` covers creating a mission (new location, partner owner, units), the owner choices per type, editing, and a field member refused. `roster.test.tsx` covers the roster report live, and `rosterEntries.test.ts` its stint rules and CSV.
