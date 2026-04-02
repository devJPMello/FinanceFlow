import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const databaseUrl = process.env.DATABASE_URL;
const file = process.argv[2];

if (!databaseUrl) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}
if (!file || !existsSync(file)) {
  console.error('Informe arquivo SQL existente: npm run db:restore -- <arquivo.sql>');
  process.exit(1);
}

const cmd = spawnSync('psql', ['--dbname', databaseUrl, '--file', file], {
  stdio: 'inherit',
  shell: true,
});

if (cmd.status !== 0) process.exit(cmd.status ?? 1);
console.log(`Restore concluído de: ${file}`);
