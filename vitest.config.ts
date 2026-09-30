import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Workspace packages export their TypeScript source under this condition, so tests run without a build.
    conditions: ['development'],
  },
  test: {
    include: ['{apps,services,packages}/*/src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
