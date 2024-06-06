import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['*.test.ts'],
  },
  resolve: {
    alias: {
      'sigmastate-js': resolve(__dirname, 'node_modules/sigmastate-js/dist/main') // Adjust path if needed
    }
  },
  plugins: [
    tsconfigPaths()
  ]
});
