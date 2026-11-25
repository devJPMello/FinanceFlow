const base = process.env.DATABASE_URL ?? 'postgresql://financeflow:financeflow@localhost:5434/financeflow?schema=public';
/** Banco exclusivo dos testes e2e — nunca toca nos dados de desenvolvimento. */
export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? base.replace(/\/[^/?]+\?/, '/financeflow_test?');
export const ADMIN_DB_URL = base;

export function applyTestEnv() {
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.JWT_ACCESS_SECRET = 'test-access';
  process.env.JWT_REFRESH_SECRET = 'test-refresh';
  process.env.WEB_ORIGIN = 'http://localhost:5173';
  process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'financeflow-e2e-uploads');
  delete process.env.SMTP_HOST;
}
