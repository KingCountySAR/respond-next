# Deploying on the KCSARA VM

Respond runs on KCSARA's VM as its own compose project, `respond`, on the VM's `kcsara` network, behind its Caddy.
`deploy/` has what the VM needs:

- `deploy/app.json`: the app's name on the VM, and the build to send: `dist/`, a folder (the server, the UI it serves,
  and the seed and legacy imports).
- `deploy/compose.yaml`: the `respond` service. Caddy passes `/api/sync`, the app's live connection, on as a WebSocket.
- `deploy/app.env.example`: its settings.

Its data is in the VM's shared Postgres, in the `respond` database (user `respond`). See "Apps" in the vm repo's
README for how apps are deployed there.

## Deploying

```
npm run build
cd ../vm && node deploy.mjs app ../respond-sync
```

The new build replaces the old one and the app restarts with it. The one before stays on the VM as
`apps/respond/previous`.

## Sites

Every organization has its own site, told apart by host name, so each host name is in two places: in the app (the
organization's host names, from the seed file or the admin page) and in `HOSTS` in
`/srv/kcsara/apps/respond/config/compose.env` on the VM (comma separated; `respond.kingcountysar.org` when it isn't
set). A name in only one of them doesn't work: without it in `HOSTS` it has no certificate, and a name the app
doesn't know answers "No site is set up".

For now Respond runs under test names: `HOSTS=respond-next.kcesar.org, rn-4x4.kcesar.org, rn-esar.kcesar.org`.
**Moving to respond.kingcountysar.org** (and each organization's own names): add each one to `HOSTS`, its DNS and its
Google redirect URI, add it to its organization's host names in Respond, and deploy again. Then remove the test name
the same way: from the organization, `HOSTS`, Google and DNS. Once the names are settled, they can be the default in
`deploy/compose.yaml` instead.

## Setting it up

Commands with `node deploy.mjs` or `node hydra.mjs` run in the `../vm` repo (see its README for `exec` and
`restart`).

1. **Database**: `node deploy.mjs database respond`. It makes `/srv/kcsara/apps/respond/config/database.env` on the
   VM, with `DATABASE_URL`.
2. **Configuration**, on the VM: `/srv/kcsara/apps/respond/config/app.env`, from `deploy/app.env.example`:
   `SECRETS_KEY` (`openssl rand -base64 32`; it encrypts the providers' client secrets in the database, so back it
   up) and `SITE_ADMINS`. `NODE_ENV=production` (in `deploy/compose.yaml`) makes cookies Secure and sign-in callbacks
   https.
3. **Hydra client** for member lookups through cedar:
   `node hydra.mjs create oauth2-client --name Respond --grant-type client_credentials --scope members.read,d4h:members.read --format json`.
   Its id and secret go in the seed file's cedar member provider, with cedar's and Hydra's addresses on the VM's
   network: `"url": "http://cedar:3040"`, `"tokenUrl": "http://hydra:4444/oauth2/token"`.
4. **Google**: an OAuth client (Web application) whose Authorized redirect URIs list
   `https://<host name>/api/auth/callback` for each site. Its id and secret go in the seed file's sign-in provider,
   named by the top organization so every site under it uses it.
5. **The app**: deploy it (above).
6. **The organizations**, from a seed file kept out of git (it has the client secrets), run by `seed.mjs` in the
   running app's container, then a restart, since the app reads the organizations when it starts:

   ```
   node deploy.mjs exec respond respond --put <file> -- node seed.mjs '{put}/<file name>'
   node deploy.mjs restart respond
   ```

   The file goes over ssh to a temporary folder in the container, removed after. Each provider and organization in it
   replaces the stored one with its id, and nothing else changes, so it's safe to run again. See "Seeding" in the
   README for the file's shape. Each organization's `hostnames` must name its sites.
7. **Sites**: each host name in `HOSTS`, its DNS pointed at the VM, then deploy again.
8. **respond-next's data** (once, at cut-over), from `mongoexport --jsonArray` of respond-next's `activities` and
   `locations`: only those two files, which `import-legacy.mjs` reads from one folder. First with `--dry-run`, which
   only says what it would import; then without, and a restart, since the app adds imported activities to its list and
   archive when it starts:

   ```
   node deploy.mjs exec respond respond --put <export>/<db>.activities.json --put <export>/<db>.locations.json -- node import-legacy.mjs '{put}' --dry-run
   node deploy.mjs restart respond
   ```

   As with the seed, the files go to a temporary folder in the container, removed after. Activities and saved
   locations already there are skipped, so it's safe to run again. Seed the organizations first, each with its
   `legacyId` (its id in respond-next): the import finds them by it.

## On the VM

In `/srv/kcsara/apps/respond/current`: `docker compose logs respond` (or `node deploy.mjs logs respond` from the vm
repo).

## Running the build in Docker

To try the build as the VM runs it, on a dev machine: `docker compose up` in `../vm` (Hydra and its `kcsara` network;
cedar the same way in `../cedar`, if an organization's member provider uses it), `npm run db` here (the dev database),
then:

```
npm run build
npm run docker -- up -d
```

It's on http://localhost:4000, like `npm run dev` (stop that first), with the dev database's organizations and their
sites (`crt.localhost:4000`, ...). Its settings are `server/.env.local` (`SECRETS_KEY`, `SITE_ADMINS`), and it signs in
only with the dev sign-in (`DEV_TOOLS`): the build signs in with Google only over https. A member provider on cedar
needs cedar's and Hydra's addresses on the `kcsara` network (`http://cedar:3040`, `http://hydra:4444/oauth2/token`),
and a client in the local Hydra (`node hydra.mjs --local create oauth2-client ...`).

`npm run docker` is `docker compose` with both files, so `npm run docker -- logs -f` shows its logs, and
`npm run docker -- down` stops it.
(`docker compose up --build` in the repo is another way: it builds an image of the app; see the README.)
