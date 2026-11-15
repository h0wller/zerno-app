import { defineConfig, devices } from '@playwright/test';

const testPort = process.env.CI ? (process.env.PORT || '3000') : '3100';
const testUrl = process.env.TEST_URL || `http://localhost:${testPort}`;

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results',
  // Только e2e: unit-тесты (*.test.mjs) запускаются через node --test (npm run test:unit).
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]],

  use: {
    baseURL: testUrl,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // actionTimeout: 10000,
  },

  webServer: process.env.TEST_URL ? undefined : {
    command: 'node server.js',
    url: `${testUrl}/api/health`,
    // Do not reuse the developer's server: it does not expose /__test/otp and may
    // be connected to a non-test database. Reuse must be an explicit TEST_URL.
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      PORT: String(testPort),
      DB_PATH: process.env.PW_DB_PATH || './.playwright-test.db',
      NODE_ENV: 'test',
      SMS_AUTH_ENABLED: 'true',
      SMSRU_API_ID: '',
      ADMIN_CODE: String(process.env.ADMIN_CODE || '').length >= 16 ? process.env.ADMIN_CODE : 'ci-admin-role-code-2026',
      CASHIER_CODE: String(process.env.CASHIER_CODE || '').length >= 16 ? process.env.CASHIER_CODE : 'ci-cashier-role-code-2026',
      DISPATCH_CODE: String(process.env.DISPATCH_CODE || '').length >= 16 ? process.env.DISPATCH_CODE : 'ci-dispatch-role-code-2026',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // При необходимости можно добавить mobile-устройства, так как PWA адаптирована под них
    {
      name: 'Mobile Chrome',
      testIgnore: '**/menu-cards.spec.js',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
