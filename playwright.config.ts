import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env so test credentials (TEST_ADMIN_EMAIL etc.) are available in tests
dotenv.config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  testDir: '.',
  testIgnore: ['**/.claude/**'],
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  projects: [
    {
      name: 'smoke',
      testMatch: ['e2e/generated/**/*.spec.ts'],
    },
    {
      name: 'critical',
      testMatch: ['e2e/critical/**/*.spec.ts', 'tests/e2e/**/*.spec.ts'],
    },
  ],
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
