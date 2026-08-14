## Configure Development Environment

### Install dev/build tools
- [Node.js] (https://nodejs.org/en) 18.x or higher (ships with npm; the project uses npm workspaces)

**Windows users**:
- Ensure git's `autocrlf` setting is set to `false` for this repository. If it's not, Git will checkout the files with CRLF line endings and the linter will throw errors.
- If your global setting is already `false` you have nothing to do.
- To view your current setting in the terminal, run the following command from within this repository: `git config core.autocrlf`
- To set `autocrlf` for this repository only (global unchanged) run the following command from within this repository: `git config core.autocrlf false`

### Create dev database
Development is supported on either a local or remote MongoDB server.
- For a local installation, it's recommended to install the [Community Server](https://www.mongodb.com/try/download/community) and [Compass UI](https://www.mongodb.com/try/download/compass).
- For a remote DB, use [Mongo Atlas](https://www.mongodb.com/atlas/database). You can also use [Compass UI](https://www.mongodb.com/try/download/compass), but isn't strictly necessary.

In your MongoDB, add a database named `respond-dev`. If you're using Mongo Atlas, also add a user for that database. Click on "Database Access" from the left side bar navigation, then click the "Add new database user" and give them read/write permission. This username/password is what you'll use in your connection string below.

Mongo Atlas has a database creation wizard which shows up for new accounts, and may walk you through the steps above.

#### Add Seed Data to MongoDB
The app is multi-tenant, and matches hostnames to organizations stored in the database. To be able to use the application, at least one organization must be created in the database. Below are two documents that should allow you to get up and running.

The application also has integration with D4H, so you will need a Personal Access Token, either generated yourself or from your member database admin. You will also need your Organization's teamId.
**Note that a D4H Personal Access Token is equivalent to your password: it provides full access to personal information for every KCSARA member - even the bits that are marked ‘private’. Make sure you don't make this key public (e.g. by checking it in).**

[D4H - Getting Authenticated](https://api.team-manager.us.d4h.com/v3/docs#section/Introduction/Getting-Authenticated)

Personal Access Token:

- Login to D4H
- Click on the avatar in the upper right, then select "Manage Your D4H Account"
- On your account page, click on the avatar again, then select "Personal Access Tokens"
- Click "Create Token"
- Give your key a name and expiration date, select appropriate products, then click "Create Token".
- Make note of the token for the next steps.

If this fails, contact your database admin to ask for a key.

D4H Team Id:

To find your teamId open your terminal / command line and run the following command (after modifying it to replace `YOUR_ACCESS_TOKEN` with your token):

`curl -X GET -H "Authorization: Bearer YOUR_ACCESS_TOKEN" -o d4h-api-whoami-response.json https://api.team-manager.us.d4h.com/v3/whoami`

This will make a GET request to the whoami endpoint, which if successful will return a JSON response that will be stored in d4h-api-whoami-response.json in the directory from which the command is run.

Your teamId is `members[0].owner.id`:
```json
{
  "members": [
    {
      "id": 1,
      "owner":
      {
        "resourceType": "Team",
        "id": 600,
        "title": "Team Y",
      },
      "name": "Member X",
      "hasAccess": true,
      "resourceType": "Member",
    },
  ]
}
```

To fully test multi-tenancy you'll also need to be able to refer to the site by multiple host names. It may be possible to do this with a combination of `localhost` and your computer's hostname. You may also want/need to add aliases to your local machine in your hosts file (`/etc/hosts` on Linux or `C:\Windows\System32\drivers\etc\hosts` on Windows) or router DNS configuration. These hostnames will be used in the seed data. However this is optional for an initial setup.

In your MongoDB database, make sure there is a collection called `organizations` and add the following two documents. Note the two placeholders needing replacement. The first is usually "localhost", and the second is your API key:
```json
{
  "_id": "1",
  "title": "Cascade Rescue Team",
  "rosterName": "CRT",
  "mouName": "CRT",
  "brand": {
    "primary": "#154515",
    "primaryDark": "#31A031"
  },
  "domain": "<YOUR-PREFERRED-HOSTNAME-EX-localhost>",
  "memberProvider": {
    "provider": "D4HMembers",
    "token": "<YOUR-D4H-TEAM-ID>:<YOUR-D4H-TOKEN>"
  },
  "id": "1",
  "canCreateEvents": true,
  "canCreateMissions": false,
  "supportEmail": "support@cascaderescueteam.org",
  "partners": [
    {
      "id": "2",
      "title": "King County Sheriff's Office",
      "rosterName": "KCSO",
      "canCreateMissions": true,
      "canCreateEvents": false
    }
  ]
}
```
```json
{
  "_id": "2",
  "title": "King County Sheriff's Office",
  "rosterName": "KCSO",
  "domain": "kingcounty.gov",
  "id": "2"
}
```

#### Local MongoDB Server
For a local installation, add this connection string for your server and database to `.env.local`:
```
MONGODB_URI="mongodb://localhost:27017/respond-dev?retryWrites=true&w=majority"
```

#### MongoDB Atlas service:
For a remote DB, add this connection string for your database to `.env.local`:
```
MONGODB_URI="mongodb+srv://database:<your-connection-string>.mongodb.net/respond-dev?retryWrites=true&w=majority"
```

Remember that your username/password in the connection string are for the database user added above, not your MongoDB account (when using Atlas). Also be sure to URLEncode the password if it contains special characters.

### Add Google auth configuration
- Setup an OAuth 2.0 Client web app with Google (See https://support.google.com/cloud/answer/6158849?hl=en#zippy=%2Cweb-applications).
	- In the OAuth Client, add hostnames `http://localhost:3000` and `http://localhost` (`http://localhost` possibly not required? Shouldn't be used by the site) to the Authorized Javascript Origins.
- Add authentication information to `.env.local`:
```
GOOGLE_ID=<client-id>.apps.googleusercontent.com
```

## Architecture

The app is an npm-workspaces monorepo with three packages:
- **`shared/`** (`@respond/shared`) — domain types + the isomorphic state (actions/reducers) used by both client and server.
- **`server/`** (`@respond/server`) — a [Hono](https://hono.dev) Node server that owns the REST API, Google auth/session (iron-session), and the socket.io realtime server + in-memory `StateManager`. In **dev** it listens on **5173** (Vite proxies to it); in **production** it listens on **3000** and also serves the built client.
- **`client/`** (`@/client`) — a [Vite](https://vite.dev) + React SPA (routing via [wouter](https://github.com/molefrog/wouter)). The dev server runs on **3000** (the app URL) and proxies `/api` + `/socket.io` to the server.

The app URL is **http://localhost:3000** in both dev (Vite) and production (Hono).

## Start Development Server

Install once from the repo root (installs all workspaces):
```
npm install
```

Then run the server and client in **two terminals**:
```
npm run dev:server   # Hono API + socket.io on http://localhost:5173
npm run dev:client   # Vite SPA on http://localhost:3000  (the app URL)
```
Both hot-reload on save — the server via `tsx watch` (a full, fast process restart) and the client via Vite HMR. The old `/api/socket-keepalive` restart dance is gone; the socket server starts deterministically with the Hono process.

The client reads `RESPOND_SERVER_ORIGIN` (default `http://localhost:5173`) for its dev proxy target.

### SSL Proxy
Google authentication requires a secure (https://) context. Forward HTTPS on port 9001 to the Vite dev server on 3000:
```bash
npx local-ssl-proxy --target 3000
```
Add `https://localhost:9001` to your OAuth client's Authorized JavaScript Origins.

### Connect to app
Open http://localhost:3000 (or https://localhost:9001 with the proxy).

### Tests & type-checking
- `npm test` — runs the Vitest suites (shared reducers/visibility, client store).
- `npm run typecheck` — type-checks all three packages.
- `npm run build` — production build of the client SPA (`client/dist`). The server serves this in production alongside the API + websocket.