## Configure Development Environment

### Install dev/build tools
- Node.js 16.x or higher
- [Yarn](https://yarnpkg.com)

### Create dev database
Development is supported on either a local MongoDB server or an account on [Mongo Atlas](https://www.mongodb.com/atlas/database).

#### Local MongoDB Server
For a local installation, it's recommended to install the [Community Server](https://www.mongodb.com/try/download/community) and [Compass UI](https://www.mongodb.com/try/download/compass).

Add the connection string for your server and database to `.env.local`:
```
MONGODB_URI="mongodb://localhost:27017/respond-dev?retryWrites=true&w=majority"
```

#### MongoDB Atlas service:
Add the connection string for your database to `.env.local`:
```
MONGODB_URI="mongodb+srv://database:<your-connection-string>.mongodb.net/respond-dev?retryWrites=true&w=majority"
```


### Add Google auth configuration
- Setup an OAuth 2.0 Client web app with Google (See https://support.google.com/cloud/answer/6158849?hl=en#zippy=%2Cweb-applications).
- Add authentication information to `.env.local`:
```
GOOGLE_ID=<client-id>.apps.googleusercontent.com
GOOGLE_SECRET=<client-secret>
```
- Add hostname `https://localhost:3000` to your Google app's Authorized Javascript Origins

## Start Development Server

### App startup
In a terminal window:
```
yarn install
yarn dev
```

Most of the site should auto-compile and update when the source file is saved. One exception seems to be the socket server (code initialized by `/api/socket-keepalive`), which needs you to Ctrl-C the server and start `yarn dev` again.

As updates are made, the site will re-compile on demand (page load). You may notice a delay when navigating between pages.

### SSL Proxy
There are parts of the application (specifically Google authentication, possibly future geolocation) that don't work on an insecure (http://) site. To get into a secure context, we'll use an SSL proxy. HTTPS traffic on port 9001 is forwarded to an HTTP server on port 3000.

In another terminal window, start the proxy:
```bash
npx local-ssl-proxy --target 3000
```

### Connect to app
Open a web browser to https://localhost:3000


## Seed Data
The app is multi-tenant, and matches hostnames to organizations stored in the database. To be able to use the application, at least one organization must be created in the database. Below are two documents that should allow you to get up and running.

The application does have integration with the organization's membership database (currently D4H). In order to set this up you will need an API key from your member database admin.

To fully test multi-tenancy you'll also need to be able to refer to the site by multiple host namess. It may be possible to do this with a combination of `localhost` and your computer's hostname. You may also want/need to add aliases to your local machine in your `/etc/hosts` file or router DNS configuration. These hostnames will be used in the seed data.

In your MongoDB database, make sure there is a collection called `organizations` and add the following documents:
```json
{
  "_id": "1",
  "title": "Cascade Rescue Team",
  "rosterName": "CRT",
  "mouName": "CRT",
  "brand": {
    "primary": "#154515"
  },
  "domain": "<YOUR-PREFERRED-HOSTNAME-EX-localhost>",
  "memberProvider": {
    "provider": "D4HMembers",
    "token": "<YOUR-D4H-TOKEN>"
  },
  "id": "1",
  "canCreateEvents": true,
  "canCreateMissions": false,
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