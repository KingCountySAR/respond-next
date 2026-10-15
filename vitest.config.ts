import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/sync/**/*.test.ts'],
  },
});
