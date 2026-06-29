import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'generated/**', '_archive/**', 'vendor/**'],
    environment: 'node',
    globals: false,
  },
});
