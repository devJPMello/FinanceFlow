#!/usr/bin/env bash
# Arranque no Render: migrações antes do servidor (BD já disponível em start).
set -euo pipefail
cd "$(dirname "$0")/.."
npx prisma migrate deploy
exec node dist/src/main.js
