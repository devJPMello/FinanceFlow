import { defineConfig } from '@playwright/test';

const isCi = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  webServer: isCi
    ? {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
  use: {
    baseURL:
      process.env.E2E_BASE_URL || (isCi ? 'http://127.0.0.1:4173' : 'http://localhost:5173'),
    trace: 'on-first-retry',
  },
});
