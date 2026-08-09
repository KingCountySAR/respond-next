// Side-effect module: load environment variables before any other module
// (e.g. mongodb.ts) reads process.env. Must be imported first in index.ts.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

// We read `.env.local` (git-ignored, machine-specific) and `.env` (committed
// defaults) from two candidate roots so the same code works whether we're
// running the TS source in dev or the bundled single-file build in production:
//   1. process.cwd()  — production: the app dir the bundle is launched from
//      (the same dir that holds ./static; see CLIENT_DIST in index.ts).
//   2. the repo root relative to THIS source file — dev, where the .env files
//      live at the workspace root while the server runs with cwd = server/.
// In the bundle, candidate #2 resolves relative to dist/index.js and simply
// finds nothing, so it's a harmless no-op.
//
// dotenv never overwrites a variable that is already set, so the FIRST file to
// define a key wins. Ordering below therefore encodes precedence:
//   cwd/.env.local > cwd/.env > repoRoot/.env.local > repoRoot/.env
const sourceRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
for (const root of [process.cwd(), sourceRepoRoot]) {
  config({ path: resolve(root, '.env.local') });
  config({ path: resolve(root, '.env') });
}
