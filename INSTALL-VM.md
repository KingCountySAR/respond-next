Instructions to install on VM (specifically Azure Ubuntu 20.04)

These instructions have been tested on a 1 CPU / 1 GiB memory machine. A test with 0.5GiB failed during `yarn install`.

## Setup swap file
Some dev tasks will take more memory. To keep the VM small, we'll create a swap file that can be used for build tasks and unmounted to run the site.

Create the file:
```bash
sudo dd if=/dev/zero of=/mnt/4GiB.swap bs=1024 count=4194304
sudo chmod 600 /mnt/4GiB.swap
sudo mkswap /mnt/4GiB.swap
echo '/mnt/4GiB.swap none swap sw 0 0' | sudo tee -a /etc/fstab
sudo swapon /mnt/4GiB.swap
```

## Setup Nginx
```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

Create `/etc/nginx/sites-available/respond-next` with contents:
```
server {
        client_max_body_size 64M;
        listen 80;
        server_name respond-dev.kcesar.org respond-smr.kcesar.org;

        location / {
                proxy_pass              http://127.0.0.1:3000;
                proxy_read_timeout      60;
                proxy_connect_timeout   60;
                proxy_redirect          off;

                # enable websockets
                proxy_http_version      1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
        }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/respond-next /etc/nginx/sites-enabled/
```

Setup Let's Encrypt:
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d respond-dev.kcesar.org -d respond-smr.kcesar.org -d respond-4x4.kcesar.org
# enable HTTP->HTTPS redirects
sudo systemctl restart nginx
```

## Installing Node.js and run tools
The server is shipped as a single bundled `.js` file, so the VM only needs the
Node.js runtime and pm2 to run it (no build toolchain is required just to run the
app — see "Build the app" below for where the bundle comes from).
```bash
# Node.js 20 LTS (ships with npm); the server bundle targets node20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v # should be 20.x or higher
sudo npm install -g pm2
```

## Build the app
`npm run build` produces the entire deployable app as just two outputs:
- **`server/dist/index.js`** — the server as one self-contained (~2MB) file with
  every dependency inlined. No `node_modules` is copied to or installed on the VM.
- **`server/static/`** — the built client SPA that the server serves.

You can build on the VM, or build on a dev machine / CI and copy the two outputs
over. Building elsewhere means the VM needs neither the repo nor a swap file.

To build on the VM:
```bash
mkdir /web
sudo chgrp sudo /web
sudo chmod 775 /web
cd /web
git clone https://github.com/kingcountysar/respond-next
cd respond-next
npm ci
npm run build
```

## Deploy layout
Copy the two build outputs into an app directory on the VM — nothing else is
needed. For example `/web/app`:
```
/web/app/
├── index.js        # copied from server/dist/index.js
└── static/         # copied from server/static/
```
The server resolves `./static` and its env files relative to its working
directory (cwd), so pm2 must launch it with `cwd` set to this directory (see
"Run with pm2" below).

## Configure environment variables
Provide config to the server in **either** of these ways — or both, in which case
Option B wins (see the note):

### Option A — env files in the app directory
The server reads `.env.local` (secrets, git-ignored) and `.env` (committed
defaults) from its working directory **at runtime**; they are not part of the
bundle, so they simply live next to `index.js` on the server. Create
`/web/app/.env.local`:
```
NODE_ENV=production
GOOGLE_ID=<GOOGLE-CLIENT-ID>.apps.googleusercontent.com
MONGODB_URI="mongodb+srv://<username>:<password>@<my-server>.mongodb.net/<my-database>?retryWrites=true&w=majority"
```

### Option B — pm2 ecosystem file
Set the same variables in pm2's `env` block instead (see the ecosystem file
below). These take **precedence** over any `.env` files: pm2 sets them before
Node starts, and the loader never overwrites a variable that is already set.

## Run with pm2
Create `/web/app/ecosystem.config.cjs`:
```js
module.exports = {
  apps: [
    {
      name: 'respond-dev',
      script: 'index.js',
      cwd: '/web/app', // so ./static and the .env files resolve
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Option B: set config here instead of (or on top of) .env.local
        // GOOGLE_ID: '<GOOGLE-CLIENT-ID>.apps.googleusercontent.com',
        // MONGODB_URI: 'mongodb+srv://...',
      },
    },
  ],
};
```
Start the app (serves on `http://localhost:3000`):
```bash
cd /web/app
pm2 start ecosystem.config.cjs
```

## Iterative Deploy
Rebuild, refresh the two outputs, and restart pm2.

Building on the VM:
```bash
cd /web/respond-next
git pull
npm ci
npm run build
cp server/dist/index.js /web/app/index.js
rm -rf /web/app/static && cp -r server/static /web/app/static
pm2 restart respond-dev
```
Building elsewhere: copy `server/dist/index.js` and `server/static/` into
`/web/app/`, then `pm2 restart respond-dev`.

### TODO
- Define user for running the app
- Configure `pm2` to run at startup (`pm2 startup` + `pm2 save`)
- Better instructions for updating site
  - git pull
  - (turn swap on)
  - npm ci && npm run build
  - (turn swap off)
  - pm2 restart respond-dev


### Crontab tasks
- ?? `certbot renew`

### Files to backup
- `/etc/letsencrypt`
