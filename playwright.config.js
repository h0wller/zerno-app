import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: process.env.TEST_URL || 'http://localhost:3000' },
  retries: process.env.CI ? 2 : 0,
  webServer: process.env.TEST_URL ? undefined : {
    command: 'node server.js',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});