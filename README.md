## Configure Development Environment

### Install dev/build tools
- [Node.js] (https://nodejs.org/en) 16.x or higher
- [Yarn](https://yarnpkg.com)

### Create dev database
Development is supported on either a local or remote MongoDB server.
- For a local installation, it's recommended to install the [Community Server](https://www.mongodb.com/try/download/community) and [Compass UI](https://www.mongodb.com/try/download/compass).
- For a remote DB, use [Mongo Atlas](https://www.mongodb.com/atlas/database). You can also use [Compass UI](https://www.mongodb.com/try/download/compass), but isn't strictly necessary. 

In your MongoDB, add a database named `respond-dev`. If you're using Mongo Atlas, also add a user for that database. Click on "Database Access" from the left side bar navigation, then click the "Add new database user" and give them read/write permission. This username/password is what you'll use in your connection string below. 

Mongo Atlas has a database creation wizard which shows up for new accounts, and may walk you through the steps above. 

#### Add Seed Data to MongoDB
The app is multi-tenant, and matches hostnames to organizations stored in the database. To be able to use the application, at least one organization must be created in the database. Below are two documents that should allow you to get up and running.

The application also has integration with D4H, so you will need an API key, either generated yourself or from your member database admin.
**Note that a D4H API key is equivalent to your password: it provides full access to personal information for every KCSARA member - even the bits that are marked ‘private’. Make sure you don't make this key public (e.g. by checking it in).**
Try to get a key yourself:
- Login to D4H
- Click on the small head icon in the upper right and go to "My Settings"
- Click on API access keys
- Give your key a name and click "Generate API Access Key". You'll use this key in the next section. 

If this fails, contact your database admin to ask for a key. 

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
    "token": "<YOUR-D4H-TOKEN>"
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
GOOGLE_SECRET=<client-secret>
```

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
There are parts of the application (specifically Google authentication, possibly future geolocation) that don't work on an insecure (http://) site. To get into a secure context, we'll use an SSL proxy. HTTPS traffic on port 9001 is forwarded to an HTTP server on port 3000. If needed you can run a proxy using npx. In this case you probably need to update your OAuth client's Authorized Javascript Origins to include `https://localhost:9001` and `https://localhost` (`https://localhost` possibly not required? Shouldn't be used by the site).

In another terminal window, start the proxy:
```bash
npx local-ssl-proxy --target 3000
```

### Connect to app
Open a web browser to http://localhost:3000 or https://localhost:9001 with the proxy.


