import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    // actionTimeout: 10000,
  },

  webServer: process.env.TEST_URL ? undefined : {
    command: 'node server.js',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 минуты на старт сервера
    // CI-DEFAULTS v1: сервер в CI не видит .env (файл в .gitignore),
    // поэтому стафф-коды прокидываем явно — те же значения, что в .env.example.
    // Без этого activate(3364) на ui-baseline.spec.js отдаёт 403.
    env: {
      PORT: process.env.PORT || '3000',
      DB_PATH: process.env.DB_PATH || './zerno.db',
      ADMIN_CODE: process.env.ADMIN_CODE || '3364',
      CASHIER_CODE: process.env.CASHIER_CODE || '2468',
      DISPATCH_CODE: process.env.DISPATCH_CODE || '5719',
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
      use: { ...devices['Pixel 5'] },
    },
  ],
});