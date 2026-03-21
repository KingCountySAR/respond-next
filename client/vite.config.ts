import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: {
    outDir: '../server/static'
  },
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy /api, /auth, /events to the Hono server in dev
      // This means the browser never does cross-origin requests — no CORS headaches
      '/api': 'http://localhost:5173',
      '/auth': 'http://localhost:5173',
      '/events': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
    },
  },
})