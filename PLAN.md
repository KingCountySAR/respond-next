# Plan

Where Respond (Mission Sync, this repo) stands, and what's next. Written 2026-10-20 (brought up to date
2026-10-24) to carry work across sessions; the READMEs describe how things work, this file what's left to do.

## Where it stands

**Deployed** on KCSARA's VM as its own compose project, `respond`, from `deploy/` (see [docs/DEPLOY.md](docs/DEPLOY.md)):
`npm run build`, then `node deploy.mjs app ../respond-sync` in `../vm`. Seeded from `kcsara.seed.json` (this repo's
root, kept out of git through `.git/info/exclude`: it gets client secrets added by hand). Work is on the
`respond-sync` branch.

## To do

### 1. Migration from MongoDB

Built 2026-10-20, brought back 2026-10-24: `npm run import-legacy -- <export folder> [--dry-run]` (`server/src/importLegacy.ts`,
converting in `server/src/legacy.ts`; bundled as `dist/import-legacy.mjs`), from a `mongoexport --jsonArray` of
respond-next's `activities` and `locations` (`../respond-next/export`, untracked there, is one from 2026-10-16). See
README, "Importing from respond-next". Organizations map by `legacyId` (new on `Organization`, set in seed files);
`kcsara.seed.json` has it on all nine, including IST, SMR, RSVU, KCSD and SPART, added from respond-next's
organization docs. Legacy 7 was given to both RSVU and SPART: a unit's roster name decides.

Tried on that export in a throwaway `respond_legacy_trial` database (in the dev Postgres): 1942 activities (125,783
records) and 181 saved locations (the same again in a dry run on 2026-10-24); a second run skipped them all; the
server's start added 1684 summaries (the 258 removed activities have none); every activity, read back through the server, matched the export (24,393 people's
current status and unit, 115 teams' members).

Still to do:

- **New organizations' settings**: `emailDomains` are empty and `providerUnit` is their roster name, a guess: check
  against cedar's unit titles. Their `hostnames` are respond-next's domains for them.
- **Cut-over**: deploy a build (it has `import-legacy.mjs`) and seed (for the `legacyId`s); a fresh export with
  respond-next stopped or read-only; then the import through vm's `node deploy.mjs exec`, `--dry-run` first, and a
  restart (docs/DEPLOY.md, step 8); then DNS for the real names (below). Not tried against the VM yet.
- **Who changed a status**: respond-next's timeline entries carry `lastUpdatedBy` from 2026-10-23 (its #198), and the
  import makes it `byName` (or `cause` for its "System: …" entries). The 2026-10-16 export predates it, so only the
  cut-over export will have any.
- **The activity log**: imported activities' logs start empty (they could be made from the imported timelines).

### 2. Host names

Moving to `respond.kingcountysar.org` and each organization's own names. Each name is in two places: an
organization's `hostnames` in the app (seed file or admin page) and `HOSTS` in the VM's `compose.env` (see
docs/DEPLOY.md, "Sites"), plus DNS and the Google client's redirect URI (`https://<name>/api/auth/callback`).

### 3. Activities seen within their organization tree

Parked by the user ("not yet"). Today every signed-in person sees every activity in the list (one global
`$activities` scope). Proposal: an activity is visible within the organization tree of its owner and of its units'
organizations; a partner in another tree sees it once one of its units is on it. Matters as soon as two trees share
a server.

### 4. Metrics

Deferred. Prometheus `/metrics` from `prom-client` on its own port (`METRICS_PORT`, e.g. 9464, never through nginx),
scraped by vm's Prometheus like Hydra's admin port, plus a Grafana dashboard and alerts there. Metric names use the
`respond_` prefix: activities in memory, connections, subscriptions, mutations by outcome, commits, storage conflicts,
loads and unloads, one-time reads, summary writes, push and commit times.

### 5. Activity log history

Activities from before the log have no lines. The server could fill a log scope from `mutation_log` the first time
it's opened (the narration needs the records as they were, so replay or effects).

### 6. Smaller gaps

- Saved locations: the description isn't shown, and the saved link is dropped when one is used on an activity.
- Signing out ends this site's session, not Google's.
- Tiers come from member groups as of sign-in; a change in D4H counts from the next sign-in.
- Visitors can't sign in yet (planned: by invitation).
- A member without a photo shows a broken image (initials instead: deferred by the user).

### 7. Sync shortcuts (none urgent)

Commit batching across activities (~10 ms), telling clients to reload on a new build, an HTTP fallback transport,
`permessage-deflate`, a cross-activity outbox.

## Reminders

- respond-next and cedar are read-only. Don't change other projects except vm when asked.
- Commit only when asked, on `respond-sync`, ending with the Co-Authored-By line.
- Dependencies at least 2 weeks old, exact versions, installed with `npx -y npm@11.6.2 install`.
- Dev: the user runs `npm run dev` (UI on 4000, server on 5174); Postgres is `respond-sync-postgres-1` on 5433.
- Production config lives only on the VM (`/srv/kcsara/apps/respond/config`); back up its `SECRETS_KEY`, which decrypts
  the providers' secrets.
