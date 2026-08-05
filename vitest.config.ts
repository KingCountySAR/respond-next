import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Unit tests for the shared package and the client store. `@respond/shared`
// resolves as a workspace package; client-internal aliases mirror vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@respond/components': r('client/src/components'),
      '@respond/hooks': r('client/src/hooks'),
      '@respond/lib': r('client/src/lib'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['shared/**/__tests__/**/*.ts', 'client/**/__tests__/**/*.ts'],
  },
});
