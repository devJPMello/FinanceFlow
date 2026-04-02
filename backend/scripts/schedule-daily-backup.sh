#!/usr/bin/env sh
# Exemplo cron (Linux/macOS): cópia para o servidor, tornar executável (chmod +x),
# e no crontab do utilizador que tem pg_dump e DATABASE_URL:
#
#   0 3 * * * cd /caminho/para/financeflow/backend && BACKUP_RETENTION_COUNT=14 DATABASE_URL="..." node ./scripts/backup-db.mjs >> ./logs/backup.log 2>&1
#
# Variáveis úteis:
#   DATABASE_URL   — obrigatória (mesma do .env de produção)
#   BACKUP_RETENTION_COUNT — opcional; mantém só os N ficheiros mais recentes em ./backups

set -e
cd "$(dirname "$0")/.."
export BACKUP_RETENTION_COUNT="${BACKUP_RETENTION_COUNT:-14}"
node ./scripts/backup-db.mjs
