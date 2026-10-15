# Build stage: install everything, build the UI into dist/public and bundle the server into dist/index.mjs.
FROM node:22.20.0-alpine AS build
WORKDIR /app
# npm 10 crashes resolving this tree's peer dependencies (see README).
RUN npm install -g npm@11.6.2

# Manifests first, so dependency installs are cached until a package.json changes.
COPY package.json package-lock.json ./
COPY packages/sync-core/package.json packages/sync-core/
COPY packages/sync-client/package.json packages/sync-client/
COPY packages/sync-server/package.json packages/sync-server/
COPY packages/toy-domain/package.json packages/toy-domain/
COPY server/package.json server/
COPY test/harness/package.json test/harness/
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage: just the bundle and the static UI; no node_modules.
FROM node:22.20.0-alpine
WORKDIR /app
COPY --from=build /app/dist ./
USER node
EXPOSE 4000
CMD ["node", "--enable-source-maps", "index.mjs"]
