import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['services/**', 'middleware/**', 'controllers/**'],
      exclude: ['node_modules/**', 'tests/**'],
    },
    include: ['tests/**/*.test.js'],
    testTimeout: 10000,
  },
});
