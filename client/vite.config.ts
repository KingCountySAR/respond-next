import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { compression } from 'vite-plugin-compression2';

const SERVER_ORIGIN = process.env.RESPOND_SERVER_ORIGIN ?? 'http://localhost:5173';
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The client is a pure SPA. In dev, Vite proxies API + websocket traffic to the
// Hono server so the browser sees a single same-origin app (no CORS needed).
// `@respond/shared` is NOT aliased here — it resolves as a real workspace package
// (via its package.json `exports`), the same way the server consumes it.
export default defineConfig({
  build: {
    outDir: '../server/static',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    // Emit a .gz and .br next to each asset at build time (originals kept for clients
    // that don't accept gzip). The Hono server serves these via 'precompressed'.
    compression({ algorithms: ['gzip', 'brotliCompress'], threshold: 1024 }),
  ],
  resolve: {
    alias: {
      '@respond/components': r('src/components'),
      '@respond/hooks': r('src/hooks'),
      '@respond/lib': r('src/lib'),
      '@/client': r('src'),
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    port: 3000,
    proxy: {
      '/api': { target: SERVER_ORIGIN, changeOrigin: true },
      '/socket.io': { target: SERVER_ORIGIN, ws: true, changeOrigin: true },
    },
  },
});
