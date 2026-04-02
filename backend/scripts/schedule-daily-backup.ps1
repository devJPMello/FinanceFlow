# Exemplo Agendador de Tarefas Windows:
#   Ação: powershell.exe
#   Argumentos: -NoProfile -ExecutionPolicy Bypass -File "C:\...\FinanceFlow\backend\scripts\schedule-daily-backup.ps1"
#   Definir variáveis de ambiente na tarefa ou num .env carregado à parte.
#
#   $env:DATABASE_URL = "postgresql://..."
#   $env:BACKUP_RETENTION_COUNT = "14"

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not $env:DATABASE_URL) {
  Write-Error 'DATABASE_URL nao definida'
}
if (-not $env:BACKUP_RETENTION_COUNT) { $env:BACKUP_RETENTION_COUNT = '14' }
node (Join-Path $PSScriptRoot 'backup-db.mjs')
