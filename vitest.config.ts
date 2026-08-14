import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Unit tests across all three modules. vitest resolves via vite `resolve.alias`,
// so every path alias used in source must be mirrored here: `@shared`/`@server`
// for the server module, and the client-internal aliases (mirroring vite.config.ts).
export default defineConfig({
  resolve: {
    alias: {
      '@shared': r('shared/src'),
      '@server': r('server/src'),
      '@respond/components': r('client/src/components'),
      '@respond/hooks': r('client/src/hooks'),
      '@respond/lib': r('client/src/lib'),
      '@/client': r('client/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['shared/**/__tests__/**/*.ts', 'client/**/__tests__/**/*.ts', 'server/**/__tests__/**/*.ts'],
    // mongodb-memory-server downloads/spins up a real mongod on first server-test run.
    testTimeout: 30000,
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['shared/src/**', 'client/src/**', 'server/src/**'],
      exclude: ['**/__tests__/**', '**/*.d.ts'],
    },
  },
});
