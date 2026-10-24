// Bundles the server and every dependency into one file, dist/index.mjs (run with `node dist/index.mjs`),
// and the seed import beside it, dist/seed.mjs (`node dist/seed.mjs <file>`; see src/seed.ts), and the respond-next
// import, dist/import-legacy.mjs (`node dist/import-legacy.mjs <export folder>`; see src/importLegacy.ts).
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const path = (p) => fileURLToPath(new URL(p, import.meta.url));

await build({
  entryPoints: { index: path('./src/main.ts'), seed: path('./src/seed.ts'), 'import-legacy': path('./src/importLegacy.ts') },
  outdir: path('../dist'),
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  legalComments: 'linked',
  define: { 'process.env.NODE_ENV': '"production"' },
  // Optional native speedups that `ws` loads only if installed.
  external: ['bufferutil', 'utf-8-validate'],
  // Bundled CommonJS dependencies call require(); give them one in ESM.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: 'info',
});
