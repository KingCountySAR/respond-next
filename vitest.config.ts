import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The web tests render the whole app over a simulated network; with every file running at once
    // they can take longer than vitest's 5 s default.
    testTimeout: 20_000,
    include: ['packages/*/__tests__/**/*.test.{ts,tsx}', 'web/__tests__/**/*.test.{ts,tsx}', 'test/integration/**/*.test.ts', 'server/__tests__/**/*.test.ts'],
  },
});
