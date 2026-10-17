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
| `src/sections/field` | Home and the activity page (`/mission/:id`, `/event/:id`): desktop and mobile layouts, briefing and manager panels, unit chips, roster with the participant dialog, the status button and its confirm form, ETA and miles. Loads with the shell |
| `src/sections/ops`, `reports`, `admin` | Load the first time their route is visited |
| `src/ui` | Shared components with no data of their own, mostly the legacy ones as they were (`OutputForm`, `SplitButton`, `RelativeTimeText`, ...), and `status.ts`: the legacy words and colours for each status |
| `src/shell/dialogs`, `preferences.tsx` | The legacy dialog provider (`useDialogs()`: `open`, `confirm`, `alert`) and per-device preferences |

## Rules

- **Sections don't import each other.** Each may use the shell, `ui`, its own files and the packages. The shell imports a section only through its `index.ts`. `__tests__/boundaries.test.ts` checks both, until ESLint's boundary rules are set up.
- **Read through the models,** inside `observer(...)`. A component that reads the model without `observer` renders once and goes stale.
- **Use `activity.clock` or `client.now()` for "now",** never `Date.now()`: it's the server's clock.

## Sign-in for now

There is no Google sign-in until phase 2. The login panel's offline path asks who you are (name, person ref, tier, class) and keeps it in `localStorage`. The SyncClient sends it on the WebSocket URL, which is the server's dev auth. Phase 2 replaces this with Google sign-in and a session cookie, and the tier comes from each activity's grants instead.

## Not here yet

- **The activity page is ported; the rest are placeholders** that say which step ports them: New/Edit activity, Home's lists, the ops dashboard, reports, admin.
- **Add Responder** (command adding someone from the member database) needs member search on the server, so the button isn't there yet.
- **Member photos** point at `/api/v1/organizations/<unit>/members/<id>/photo`, which the server doesn't serve yet, so the participant dialog shows a broken image.
- **Home has no activity lists.** My Activity, Missions and Events need activity summaries from the server, so for now an activity is opened by id.
- **No "Activity not found".** The client can't yet tell an activity the server doesn't have from one that hasn't synced, so `ActivityLayout` shows "Loading activity..." until the record arrives.
- **Not yet ported:** the per-organization manifest and icons (`/api/manifest.webmanifest`, `/api/icon/*`).

## Tests

`__tests__/app.tsx` renders the whole app in jsdom against the real activity actor over the simulated network, with a command client that set the activity up. `shell.test.tsx` covers sign-in, the connection icon, the ops guard, a legacy redirect and sign-out; `field.test.tsx` the activity page: briefing, units, roster, changing your own status (and command seeing it), signing in from the status button, the participant dialog, and a refused Complete.
