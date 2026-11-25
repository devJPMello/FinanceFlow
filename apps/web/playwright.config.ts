import { defineConfig } from '@playwright/test';

/**
 * Testes de fluxo ponta a ponta (front + API + banco).
 * Sobe `npm run dev` na raiz se os servidores ainda não estiverem rodando.
 * Usa o Chrome instalado (E2E_CHANNEL=chrome) ou o Chromium do Playwright (padrão no CI).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    channel: process.env.E2E_CHANNEL || undefined,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        cwd: '../..',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
