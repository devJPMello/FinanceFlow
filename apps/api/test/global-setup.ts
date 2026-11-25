import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { ADMIN_DB_URL, applyTestEnv, TEST_DB_URL } from './env';

export default async function globalSetup() {
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_DB_URL } } });
  const name = new URL(TEST_DB_URL).pathname.slice(1);
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } catch {
    /* já existe */
  } finally {
    await admin.$disconnect();
  }
  applyTestEnv();
  execSync('npx prisma migrate deploy', { cwd: __dirname + '/..', stdio: 'ignore', env: { ...process.env, DATABASE_URL: TEST_DB_URL } });
}
