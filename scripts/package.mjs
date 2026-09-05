// Assemble the deploy artifact at repo-root ./package. Layout:
//
//   package/
//     .env.example      # template; operator copies to .env.local in the DEPLOY dir
//     package.json      # runner: `npm start` -> `node dist/index.js`
//     dist/             # the per-deploy payload — rsync JUST this each time
//       index.js        #   server bundle (all pure-JS deps inlined)
//       index.js.map    #   readable production stack traces
//       static/         #   built client SPA (with .gz/.br)
//       assets/   #   server-consumed assets (e.g. default brand icon), source-controlled
//       package.json    #   { type: module } so the bundle loads as ESM anywhere
//
// Run via `npm run package` (which builds first). No `npm install` on the server —
// the bundle inlines every pure-JS dependency.
//
// Deploy model — the deploy dir is the CWD you run the app from and holds secrets:
//
//   FIRST TIME:  rsync -az package/ user@host:/srv/respond/     # whole thing once
//                ssh user@host 'cd /srv/respond && cp .env.example .env.local && $EDITOR .env.local'
//   EVERY TIME:  rsync -az --delete package/dist/ user@host:/srv/respond/dist/
//                ssh user@host 'cd /srv/respond && npm start'
//
// The `dist/`-only rsync never touches /srv/respond/.env.local. At runtime cwd is
// the deploy dir (parent of dist/): env.ts reads .env.local from cwd there, while
// index.ts resolves ./static relative to the bundle file (dist/static).

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'package');
const distDir = join(outDir, 'dist');
const serverBundle = join(repoRoot, 'server', 'dist', 'index.js');
const clientStatic = join(repoRoot, 'server', 'static');
const assets = join(repoRoot, 'server', 'assets');

const rel = (p) => p.slice(repoRoot.length + 1).replaceAll('\\', '/');

function copy(from, to) {
  cpSync(from, to, { recursive: true });
  console.log(`  ${rel(from)} -> ${rel(to)}`);
}

// Fail loudly if `npm run build` hasn't produced the inputs we assemble.
for (const required of [serverBundle, clientStatic, assets]) {
  try {
    readFileSync(required); // file: reads bytes; dir: throws EISDIR (which means it exists)
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Missing build output: ${rel(required)}\nRun \`npm run build\` first (or use \`npm run package\`).`);
      process.exit(1);
    }
    if (err.code !== 'EISDIR') throw err;
  }
}

let gitSha = 'unknown';
try {
  gitSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot }).toString().trim();
} catch {
  // not a git checkout / git unavailable — leave as 'unknown'
}

console.log(`Packaging deploy artifact into ${rel(outDir)}/`);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

// ── dist/ : the per-deploy payload ──────────────────────────────────────────
copy(serverBundle, join(distDir, 'index.js'));
copy(`${serverBundle}.map`, join(distDir, 'index.js.map'));
copy(clientStatic, join(distDir, 'static'));
copy(assets, join(distDir, 'assets'));

const rootPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

// dist/package.json — `type: module` makes `node dist/index.js` load the ESM
// bundle regardless of what's above it, and travels with each dist rsync so the
// deployed version/sha is always accurate. No dependencies (all inlined).
writeFileSync(
  join(distDir, 'package.json'),
  JSON.stringify(
    { name: 'respond-server', version: rootPkg.version, private: true, type: 'module', gitSha, builtAt: new Date().toISOString() },
    null,
    2,
  ) + '\n',
);
console.log('  wrote dist/package.json');

// ── deploy dir : one-time setup files (rsync'd only on first deploy) ─────────

// Runner so `npm start` from the deploy dir (cwd = parent of dist/) launches the
// bundle. cwd stays the deploy dir so env.ts finds .env.local next to it.
writeFileSync(
  join(outDir, 'package.json'),
  JSON.stringify(
    { name: 'respond-deploy', version: rootPkg.version, private: true, type: 'module', scripts: { start: 'node dist/index.js' } },
    null,
    2,
  ) + '\n',
);
console.log('  wrote package.json');

// Env template. Real secrets go in .env.local (git-ignored), created in the deploy
// dir and read from cwd at startup.
writeFileSync(
  join(outDir, '.env.example'),
  [
    '# Copy to .env.local in this directory (the dir you run `npm start` from) and',
    '# fill in real values. The server reads .env.local then .env from its working',
    '# directory at startup. A `dist/`-only rsync never overwrites this .env.local.',
    'PORT=3000',
    'NODE_ENV=production',
    'MONGODB_URI="mongodb://localhost:27017/respond"',
    'GOOGLE_ID=<client-id>.apps.googleusercontent.com',
    '',
  ].join('\n'),
);
console.log('  wrote .env.example');

console.log(
  [
    '',
    'Done. First deploy (whole folder), then per-deploy (dist/ only):',
    '  rsync -az package/ user@host:/srv/respond/            # once',
    '  rsync -az --delete package/dist/ user@host:/srv/respond/dist/   # each time',
    'then on the host: cd /srv/respond && npm start',
  ].join('\n'),
);
