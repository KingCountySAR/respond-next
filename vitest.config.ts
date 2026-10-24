import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The web tests render the whole app over a simulated network; with every file running at once
    // they can take longer than vitest's 5 s default.
    testTimeout: 20_000,
    // Two parts, to run on their own with `npm run test:unit` or `npm run test:dom`: everything else is
    // quick, and the DOM tests are most of the time.
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['packages/*/__tests__/**/*.test.{ts,tsx}', 'test/integration/**/*.test.ts', 'server/__tests__/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['web/__tests__/**/*.test.{ts,tsx}'],
          // Each file loads the app afresh; pre-bundled, MUI and friends load in one piece instead of
          // module by module, which halves the run.
          deps: { optimizer: { client: { enabled: true, include: ['@mui/material', '@mui/icons-material', '@mui/x-date-pickers', '@mui/x-data-grid', 'react', 'react-dom', 'date-fns'] } } },
        },
      },
    ],
  },
});
