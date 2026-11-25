# FinanceFlow

Organização de gastos com importação de planilhas (CSV, XLSX, OFX).

- **web**: React + Vite + TypeScript + Tailwind + TanStack Query, organizado em Atomic Design (`atoms → molecules → organisms → templates → pages`)
- **api**: NestJS + Prisma + PostgreSQL, auth JWT (access + refresh com rotação), Swagger em `/docs`
- **shared**: schemas Zod e tipos compartilhados entre front e back

## Como rodar

```powershell
npm install
docker compose up -d                       # Postgres 16
copy .env.example apps\api\.env            # já existe um apps/api/.env de desenvolvimento
npm run db:migrate -- --name init          # cria as tabelas
npm run db:seed                            # usuário demo@financeflow.dev / demo12345
npm run dev                                # api :3000  |  web :5173
```

- App: http://localhost:5173  — API docs: http://localhost:3000/docs
- Arquivos de teste de importação em `samples/`.

## Importação

1. **Arquivo** — CSV (separador e encoding detectados), XLSX ou OFX (até 5 MB).
2. **Mapeamento** — escolha conta, colunas de data/descrição/valor (ou crédito/débito), formato de data e separador decimal.
3. **Revisão** — linhas novas, duplicadas (hash conta+data+valor+descrição, ou FITID no OFX) e com erro; categorias sugeridas por regras (`/category-rules`) e editáveis.
4. **Confirmação** — cria as transações em uma única transação de banco; o histórico permite desfazer o lote.

Limitações do MVP: XLS legado (binário) não é lido, apenas XLSX; processamento é síncrono.

## Testes

```powershell
npm test
```
