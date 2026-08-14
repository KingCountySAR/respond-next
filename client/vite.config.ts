import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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
  plugins: [react()],
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
