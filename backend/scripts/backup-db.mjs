import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const outDir = join(process.cwd(), 'backups');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = join(outDir, `financeflow-${stamp}.sql`);

const cmd = spawnSync('pg_dump', ['--dbname', databaseUrl, '--no-owner', '--file', outFile], {
  stdio: 'inherit',
  shell: true,
});

if (cmd.status !== 0) process.exit(cmd.status ?? 1);
console.log(`Backup criado: ${outFile}`);

const keep = Number(process.env.BACKUP_RETENTION_COUNT);
if (keep > 0 && Number.isFinite(keep)) {
  const files = readdirSync(outDir)
    .filter((f) => f.startsWith('financeflow-') && f.endsWith('.sql'))
    .map((name) => ({ name, t: statSync(join(outDir, name)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const row of files.slice(keep)) {
    unlinkSync(join(outDir, row.name));
    console.log(`Backup antigo removido: ${row.name}`);
  }
}
