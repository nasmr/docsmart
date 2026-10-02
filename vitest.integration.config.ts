import { defineConfig } from 'vitest/config';

// Tests against Postgres and SeaweedFS from Docker Compose (pnpm db:up first).
export default defineConfig({
  resolve: { conditions: ['development'] },
  test: {
    include: ['{apps,services,packages}/*/src/**/*.int.test.ts'],
    globalSetup: ['services/api/src/test/global-setup.ts'],
    // One database: files run one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
