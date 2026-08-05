// Side-effect module: load environment variables before any other module
// (e.g. mongodb.ts) reads process.env. Must be imported first in index.ts.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
// Load .env.local first so its values win, then .env fills in the rest.
// dotenv does not overwrite variables that are already set, so first-loaded wins.
config({ path: resolve(repoRoot, '.env.local') });
config({ path: resolve(repoRoot, '.env') });
