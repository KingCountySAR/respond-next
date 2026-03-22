import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  build: {
    outDir: '../server/static',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      'react-dom': 'react-dom',
    },
    dedupe: ['react', 'react-dom', 'mobx', 'mobx-react-lite'],
  },
  plugins: [
    react({
			// Enable JSX Decorators
			// NOTE: we need this for MobX
			useAtYourOwnRisk_mutateSwcOptions(options) {
				options.jsc!.parser!.decorators = true;
				options.jsc!.transform!.decoratorVersion = '2022-03';
			},

			// Force SWC transforms to run during `vite build` as well
			plugins: [],
    })
  ],
  server: {
    port: 3000,
    proxy: {
      // Proxy /api, /auth, /events to the Hono server in dev
      // This means the browser never does cross-origin requests — no CORS headaches
      '/api': 'http://localhost:5173',
      '/events': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
    },
  },
})