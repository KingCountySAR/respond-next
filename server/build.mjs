// Bundles the server and every dependency into one file: dist/index.mjs (run with `node dist/index.mjs`).
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const path = (p) => fileURLToPath(new URL(p, import.meta.url));

await build({
  entryPoints: [path('./src/main.ts')],
  outfile: path('../dist/index.mjs'),
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
