import { defineConfig, devices } from '@playwright/experimental-ct-react';

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.ct.tsx',
  timeout: 15_000,
  use: {
    ...devices['Desktop Chrome'],
    ctPort: 3100,
  },
  reporter: 'list',
});
