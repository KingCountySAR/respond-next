import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser only ever talks to :4000; API and WebSocket calls are proxied to the dev server.
const api = `http://localhost:${process.env.SERVER_PORT ?? 5174}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4000,
    strictPort: true,
    proxy: {
      '/api': { target: api, ws: true },
      '/health': api,
    },
  },
  build: {
    // Stand-in UI until web/ exists: built next to the server bundle, which serves it.
    outDir: '../../dist/public',
    emptyOutDir: true,
  },
});
