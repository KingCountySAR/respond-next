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

## Installing Node.js and other build/run tools
```bash
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

sudo apt update # to pick up the new sources
sudo apt install yarn nodejs
node -v # should be 16.x or higher
yarn --version # should not throw an error about missing scenarios (there's another yarn command in default Ubuntu)
sudo npm install -g pm2
 ```

 ### Install and build the app
 We'll put the app in a folder where admins have write permissions. Assumes admins are in the `sudo` group.
 ```
 mkdir /web
 sudo chgrp sudo /web
 sudo chmod 775 /web
 cd /web
 git clone https://github.com/kingcountysar/respond-next
 cd respond-next
 ```

Write the following to `.env.local`:
```
GOOGLE_ID=<GOOGLE-CLIENT-ID>.apps.googleusercontent.com
GOOGLE_SECRET=<app secret>
AUTH_TRUST_HOST=true
SECRET_COOKIE_PASSWORD=<secret from `openssl rand -base64 32`>
SESSION_COOKIE_NAME=appSession
MONGODB_URI="mongodb+srv://<username>:<password>@<my-server>.mongodb.net/<my-database>?retryWrites=true&w=majority"
```

Now, complete a build using the configured environment:
 ```
 yarn install
 yarn build
 ```

 Start the app on `http://localhost:3000`:
 ```bash
 pm2 start npm --name respond-dev -- start
 ```

### TODO
- Define user for running the next.js app
- Configure `pm2` to run at startup
- Better instructions for updating site
  - git pull
  - (turn swap on)
  - yarn install && yarn build
  - (turn swap off)
  - pm2 restart respond-dev


### Crontab tasks
- ?? `certbot renew`

### Files to backup
- `/etc/letsencrypt`