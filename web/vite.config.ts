import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The browser only ever talks to :4000; API and WebSocket calls are proxied to the dev server.
const api = `http://localhost:${process.env.SERVER_PORT ?? 5174}`;

/**
 * Writes brotli and gzip copies of the built scripts and styles beside them, for the server to send
 * (`serveStatic({ precompressed: true })`): the main bundle is about a quarter the size over the wire.
 */
function precompress(): Plugin {
  let outDir = '';
  return {
    name: 'precompress',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const assets = join(outDir, 'assets');
      for (const file of readdirSync(assets).filter((f) => /\.(js|css)$/.test(f))) {
        const path = join(assets, file);
        const body = readFileSync(path);
        writeFileSync(`${path}.br`, brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
        writeFileSync(`${path}.gz`, gzipSync(body, { level: 9 }));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), precompress()],
  server: {
    port: Number(process.env.UI_PORT ?? 4000),
    strictPort: true,
    proxy: {
      '/api': { target: api, ws: true },
      '/health': api,
    },
  },
  build: {
    // Built next to the server bundle, which serves it.
    outDir: '../dist/public',
    emptyOutDir: true,
  },
});
