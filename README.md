# Mission Sync — phase 1 (sync core)

The sync engine from the [design doc](https://claude.ai/code/artifact/5d9c89c9-2e7f-4514-a96b-71bfd37fb841), proven on a stand-in domain before any real mission features or UI move over. See the [migration doc](https://claude.ai/code/artifact/bd6bc009-563e-432b-bbce-04dde518f554) for the phase plan.

Phase 1 gate: **convergence and network tests pass.**

## Layout

| Path | Package | What it is |
| --- | --- | --- |
| `packages/sync-core` | `@sync/core` | Shared by client and server: records, `Tx`/overlay, `defineMutation`, wire protocol, client activity state (optimistic apply + rebase), clock sync |
| `packages/sync-client` | `@sync/client` | `SyncClient` (connection, reconnect/backoff, ping, batching, persistence), WebSocket transport, IndexedDB persistence, React hooks (`@sync/client/react`) |
| `packages/sync-server` | `@sync/server` | `ActivityActor` (one per activity, serial apply, per-view fan-out), `Hub` (connections → actors), storage interface + in-memory storage |
| `packages/domain` | `@sync/domain` | The activity model (missions, trainings and other activities): records, queries, mutations, field projections. Shared by `web` and `server`; the server and harness run on it |
| `packages/model` | `@sync/model` | Prototype UI model: MobX store fed from client snapshots, field and command models (`FieldActivity` ← `CommandActivity`, ...) over the domain queries, a server clock, and a React provider (`@sync/model/react`) |
| `server` | `server` | Hono app: `/api/sync` WebSocket, `/health`, dev debug endpoint, static UI. `build.mjs` bundles it to `dist/index.mjs`. Auth and REST land here |
| `test/harness` | `harness` | Test harness: side-by-side command, member and external clients on the real domain (through `@sync/model`), with per-client latency and offline switches, pending queue, rejections, message log |
| `packages/*/__tests__` | | Unit tests next to their package: rebase and `testDomain.ts`, a small people-and-statuses domain the engine tests share (`sync-core`), storage and the Postgres suite (`sync-server`), activity rules and projections (`domain`) |
| `test/integration` | | Tests across packages: seeded convergence simulation (4 clients, 20 seeds) with variable latency, jitter and dropped connections, in-order delivery like TCP; the activity domain on the real activity actor |
| `test/smoke.ts` | | End-to-end check against a running server over real WebSockets |

Planned, not created yet:

- `web/`: the single SPA. `src/shell` (routing, auth, layout, the `SyncClient` provider), `src/sections/{field,ops,reports,admin}` loaded lazily by route, `src/ui` shared components. ESLint boundary rules keep sections from importing each other.
- `packages/devtools`: `SyncPanel`, the in-app panel for connection state and outstanding changes, also used by the harness.

## Commands

Requires Node 22.12+ and **npm 11** (npm 10 crashes resolving this tree's peer dependencies). Use `npx npm@11 install` if your global npm is older.

```sh
npm install
npm run db               # Postgres 18 in Docker, host port 5433
npm test                 # unit, convergence and storage tests (Postgres suite runs when the db is up)
npm run typecheck
npm run dev              # starts the db, UI on :4000, API server on :5174 behind Vite's proxy (the harness until web/ exists)
npm run dev:harness      # same, always the harness
npm run build            # dist/index.mjs (server, all deps bundled) + dist/public (UI)
npm run start            # node dist/index.mjs: UI and API on :4000 (set DATABASE_URL, else in-memory)
docker compose up --build  # app + Postgres; app on :4000 (APP_PORT to change the host port)
npm run smoke            # end-to-end check against :4000; works with any of the above
```

**Ports.** The browser always uses `http://localhost:4000`, which keeps one OAuth redirect URL for every mode. In dev, Vite forwards `/api/**` (WebSocket included) and `/health` to the server on `:5174` (`server/.env.development`; `SYNC_LOG=1` logs every message).

**Routes.** `/api/sync` (WebSocket), `/api/debug/activities/<activityId>?view=command|field:member|field:external` (dev only; off in the production bundle), `/health`. Anything else serves the UI, falling back to `index.html` for client-side routes.

**Storage.** `DATABASE_URL` selects Postgres; without it the server uses in-memory storage (and warns in production). Each commit is one transaction covering records, per-client mutation ids and the mutation log, guarded by the activity's version so a second process writing the same activity fails with a conflict instead of overwriting. Tables (created on startup if missing): `activity_meta`, `records` (each record whole as `jsonb`), `client_mutations`, `mutation_log` (append-only; `seq` orders it). Dev uses `postgres://sync:sync@localhost:5433/sync`; storage tests create and drop a `sync_test_*` database per test (`TEST_DATABASE_URL` to point elsewhere).

**Deploy artifact.** `dist/` is self-contained: `node dist/index.mjs` needs no `node_modules`, and serves `public/` from next to itself (override with `UI_DIST`; port with `PORT`). The Docker image contains only `dist/` and runs as `node`.

## Phase 1 shortcuts (deliberate, to revisit)

- **Auth:** identity comes from `?user=&tier=&class=&person=` on the WebSocket URL (`tier` command, support or field; `class` member or external; `person` the person ref, e.g. `kcsara:101`). Replaced by the session cookie and grants in phase 2.
- **Any client may open any activity**, and activities are created on first subscribe.
- **Not yet built:** idle actor unloading, cross-actor commit batching (~10 ms), build-version `reload`, HTTP fallback transport, `permessage-deflate`, the cross-activity outbox, summaries.
