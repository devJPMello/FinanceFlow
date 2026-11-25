# FinanceFlow

Organização de gastos com importação de planilhas (CSV, XLSX, XLS, OFX).

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

1. **Arquivo** — CSV (separador e encoding detectados), XLSX, XLS ou OFX (até 5 MB).
2. **Mapeamento** — escolha conta, colunas de data/descrição/valor (ou crédito/débito), formato de data e separador decimal.
3. **Revisão** — linhas novas, duplicadas (hash conta+data+valor+descrição, ou FITID no OFX) e com erro; categorias sugeridas por regras (`/category-rules`) e editáveis.
4. **Confirmação** — cria as transações em uma única transação de banco; o histórico permite desfazer o lote.

Limitações do MVP: XLS legado (binário) não é lido, apenas XLSX; processamento é síncrono.

## Testes

```powershell
npm test
```

## Docker (tudo de uma vez)

```bash
docker compose up --build        # banco + API + web
# App: http://localhost:8080   ·   Swagger: http://localhost:8080/docs
```

Variáveis úteis (arquivo `.env` na raiz ou ambiente): `WEB_PORT`, `POSTGRES_PASSWORD`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (**troque em produção**), `SMTP_*` e `MAIL_FROM`.
As migrações rodam sozinhas ao subir a API; os comprovantes ficam no volume `uploads`.
Para desenvolver só com o banco no Docker: `npm run db:up`.

## Qualidade

| Comando | O que faz |
|---|---|
| `npm run lint` | ESLint em todo o monorepo |
| `npm test` | Testes unitários (API e web) |
| `npm run test:e2e -w @financeflow/api` | E2E da API com banco real (cria o banco `financeflow_test`) |
| `npm run test:e2e -w @financeflow/web` | Fluxos no navegador com Playwright (`E2E_CHANNEL=chrome` usa o Chrome instalado) |
| `npm run storybook -w @financeflow/web` | Catálogo de atoms/molecules em http://localhost:6006 |

O CI (`.github/workflows/ci.yml`) roda lint, build, testes, e2e e build das imagens Docker.

## Recuperação de senha

`POST /api/auth/forgot-password` envia um link de uso único (válido por 1 h) por e-mail.
Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `MAIL_FROM`. Sem SMTP, o link é
apenas escrito no log da API (útil em desenvolvimento).
