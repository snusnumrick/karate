import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5176',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 5176,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      CSP_STRICT_DEV: '1',
      NODE_ENV: 'development',
    },
  },
});