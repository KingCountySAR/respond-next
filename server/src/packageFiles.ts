import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const BUNDLE_DIR = dirname(fileURLToPath(import.meta.url));

// Two layouts are first-class: the packaged one (dist/index.js + dist/<name>, assembled
// by scripts/package.mjs) and running straight from source/server-build (src|dist/index.ts,
// with <name> living beside it at server/<name>). Whichever exists wins.
function resolveDeployedDir(name: string): string {
  const candidates = [resolve(BUNDLE_DIR, name), resolve(BUNDLE_DIR, '..', name)];
  return candidates.find(existsSync) ?? candidates[0];
}

// The compiled frontend
export const CLIENT_DIST = resolveDeployedDir('static');

// Assets the SERVER itself consumes at runtime (not client-bundled) — e.g. the default
// brand icon. Source-controlled at server/assets/, and copied into the packaged
// deploy artifact by scripts/package.mjs.
export const SERVER_ASSETS_DIR = resolveDeployedDir('assets');
