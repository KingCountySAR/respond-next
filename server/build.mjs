import { build } from 'esbuild';

// Production bundle: one self-contained ESM file (dist/index.js) that inlines all
// of our own source (server + @shared) plus every PURE-JS dependency.
//
// Deploy artifact = this file + the vite client output (server/static/). Run it
// with `node dist/index.js` from a directory that also contains ./static and,
// optionally, your .env / .env.local (dotenv reads those from cwd at RUNTIME —
// they are never bundled). No node_modules needs to be copied to the server.
//
// ─────────────────────────────────────────────────────────────────────────────
// ADDING A DEPENDENCY? ASK: "Is it pure JavaScript?"
//
//   • Pure JS  → nothing to do. esbuild inlines it into the bundle automatically.
//
//   • NOT pure JS → it CANNOT be safely inlined. This is anything that:
//       - ships a native addon (a .node binary), or
//       - resolves files/other packages via dynamic require()/__dirname at
//         runtime (esbuild can't follow those), or
//       - reads sibling files relative to its own package dir.
//     For those you must add the package name to `external` below, and then
//     decide how it reaches the server:
//       - REQUIRED at runtime → `npm install <pkg>` on the server (so now you do
//         ship a small node_modules), or vendor its files next to the bundle.
//       - OPTIONAL (loaded in a try/catch, degrades gracefully) → just leave it
//         external and don't install it. That's the case for everything listed
//         below today.
// ─────────────────────────────────────────────────────────────────────────────

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  minify: true,
  sourcemap: true, // emits dist/index.js.map so prod stack traces map to source
  // Resolves @shared/* and @server/* via the tsconfig `paths`, inlining that source.
  tsconfig: 'tsconfig.json',
  // ESM output: recreate the CommonJS globals some bundled deps still reach for.
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __esbuildDirname } from 'node:path';",
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __esbuildDirname(__filename);',
    ].join('\n'),
  },
  // ONLY true native addons (ship a .node binary) belong here. `mongodb` and
  // socket.io's `ws` load these via try/catch for optional features we don't use
  // (Kerberos/GSSAPI auth, snappy/zstd wire compression, field-level encryption,
  // ws perf helpers), so leaving them external — and never installing them — is
  // safe: the require() is caught and skipped.
  //
  // Do NOT add pure-JS packages here. They must be bundled, or `node index.js`
  // throws "Cannot find module ..." once there's no node_modules beside it. In
  // particular `socks` is a *required*, pure-JS dependency of `mongodb` (used on
  // the normal connection path), so it stays bundled. Same for `aws4`/`gcp-metadata`.
  external: ['kerberos', 'mongodb-client-encryption', '@mongodb-js/zstd', 'snappy', 'bufferutil', 'utf-8-validate'],
});

console.log('server bundle written to dist/index.js');
