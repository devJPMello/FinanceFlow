# FinanceFlow

Aplicação full stack de **gestão financeira pessoal** com visão **fiscal (TaxVision)**, **importação assistida por IA** (extratos CSV/PDF/imagem), **anexos** por lançamento e **dashboard** com orçamentos, metas e fechamento mensal. Projeto pensado para **portfolio**: código organizado, preocupação com produção (health checks, observabilidade, backups) e testes.

---

## Destaques

| Área | O quê |
|------|--------|
| **Auth** | [Clerk](https://clerk.com) (sessão no front, validação no backend) |
| **Domínio** | Transações, categorias, metas, orçamentos mensais, duplicatas, pacote contador |
| **TaxVision** | Marcadores IR, checklist, timeline, sugestões com IA (Gemini) |
| **Importação** | Pré-visualização, confirmação em lote, jobs assíncronos opcionais |
| **Operação** | `GET /api/health/live`, `/ready`, `/jobs`; Sentry opcional; scripts de backup |

---

## Stack

**Backend:** NestJS · Prisma · PostgreSQL · Swagger em `/api/docs`  
**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · React Router · Recharts · React Hook Form + Zod  

**Integrações:** Clerk · Google Gemini (IA) · Sentry (opcional)

---

## Arquitetura (visão geral)

```text
┌─────────────┐     HTTPS      ┌──────────────┐     SQL      ┌────────────┐
│  React SPA  │ ─────────────► │  NestJS API  │ ───────────► │ PostgreSQL │
│  (Vite)     │   Bearer JWT   │  /api/*      │              │            │
└─────────────┘   (Clerk)      └──────┬───────┘              └────────────┘
                                      │
                              ficheiros / fila
                                      ▼
                              uploads + worker (opcional)
```

- A API usa prefixo **`/api`**. O frontend chama `VITE_API_URL` **sem** o sufixo `/api` (configurado em `src/lib/api.ts`).
- Jobs pesados podem correr num processo **`npm run start:worker`** com `DISABLE_JOB_POLLER=true` na API.

---

## Estrutura do repositório

```text
FinanceFlow/
├── backend/           # API NestJS + Prisma
│   ├── prisma/        # schema e migrações
│   ├── scripts/       # backup, render-start.sh (migrações + node)
│   └── src/
├── frontend/          # SPA React (Vite)
│   ├── src/
│   └── tests/         # E2E (Playwright) e testes unitários (Vitest)
├── .github/workflows/ # CI
├── render.yaml        # Blueprint Render (API + Postgres + static site)
└── README.md
```

---

## Pré-requisitos

- Node.js 20+ (recomendado)
- PostgreSQL acessível (`DATABASE_URL`)
- Conta [Clerk](https://dashboard.clerk.com) (chave publishable + secret)
- (Opcional) [Google AI Studio](https://aistudio.google.com/apikey) para importação e comentários IA

---

## Como executar em local

### 1. Backend

```bash
cd backend
cp .env.example .env
# Editar .env: DATABASE_URL, CLERK_SECRET_KEY, etc.

npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

API: `http://localhost:3000` · Swagger: `http://localhost:3000/api/docs`

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Editar: VITE_API_URL, VITE_CLERK_PUBLISHABLE_KEY

npm install
npm run dev
```

App: `http://localhost:5173` (porta típica do Vite)

### 3. Worker (opcional)

Para processar fila de jobs sem competir com a API:

```bash
cd backend
# Na API: DISABLE_JOB_POLLER=true
npm run start:worker
```

---

## Variáveis de ambiente

Resumo; o detalhe está em **`backend/.env.example`** e **`frontend/.env.example`**.

| Onde | Variáveis importantes |
|------|------------------------|
| Backend | `DATABASE_URL`, `CLERK_SECRET_KEY`, `FRONTEND_URL`, `GEMINI_API_KEY` (IA), `ADMIN_OPERATIONS_SECRET` (flags), `SENTRY_DSN`, `DISABLE_JOB_POLLER` |
| Frontend | `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN` (opcional) |

### Segurança em produção (resumo)

- **Arranque:** com `NODE_ENV=production`, a API exige `DATABASE_URL` e `CLERK_SECRET_KEY` (falha cedo se faltarem).
- **Swagger:** `/api/docs` fica **desligado** em produção; define `ENABLE_SWAGGER_IN_PROD=true` só se precisares expor a documentação.
- **Feature flags (admin):** `POST /api/feature-flags/:key` exige header `x-admin-operations-secret` igual a `ADMIN_OPERATIONS_SECRET` (gera um segredo longo no painel do host).
- **IA / custos:** importação de extratos (CSV/PDF/imagem) e OCR TaxVision passam pelas mesmas quotas que o resto (`AI_DAILY_LIMIT_PER_USER`, `AI_BURST_PER_MINUTE_PER_ROUTE`). Limites de tamanho alinham-se a `IMPORT_MAX_FILE_BYTES` / anexos (ver `backend/.env.example`).
- **Isolamento:** leituras por id usam `userId` na query onde faz sentido; IDs de outros utilizadores respondem **404** (sem revelar que o recurso existe).
- **`npm audit`:** parte dos avisos vem da cadeia de **dev** (`@nestjs/cli`, eslint); `npm audit fix` sem `--force` costuma pouco; mitigar com upgrades major planeados (Nest 11+, ESLint 9) quando fizer sentido.

---

## Testes e qualidade

**CI (GitHub Actions):** workflow `.github/workflows/ci.yml` — Jest no backend, Vitest + ESLint + Playwright smoke no front (build + preview). Opcional: secret `VITE_CLERK_PUBLISHABLE_KEY` para build com Clerk real.

**Backend:** `tsconfig.json` com **`strictNullChecks: true`** (validação mais rigorosa no `nest build`).  
**E2E (Playwright):** além de `/` e `/sign-in`, o smoke percorre `/transactions`, `/dashboard`, `/categories`, `/goals`, `/tax-vision` (sem sessão Clerk — garante que a SPA não rebenta ao mudar de rota). Fluxos autenticados completos podem usar `E2E_CLERK_EMAIL` / `E2E_CLERK_PASSWORD` em local (ver comentário em `tests/e2e/critical-flows.spec.ts`).

```bash
# Backend (Jest)
cd backend && npm test

# Frontend (Vitest — modo watch: npm test; CI: uma execução)
cd frontend && npm run test:ci

# E2E browser (local: subir dev ou definir E2E_BASE_URL)
cd frontend && npm run test:e2e
```

Vitest **não** inclui `tests/e2e` (só Playwright).

---

## Deploy no Render

Há um **Blueprint** na raiz: [`render.yaml`](./render.yaml) — PostgreSQL (Frankfurt) + **Web Service** (API Node) + **Static Site** (Vite).

### Passos

1. Repositório no GitHub com `package-lock.json` **commitado** em `backend/` e `frontend/` (necessário para `npm install` estável).
2. No [Render](https://render.com): **New → Blueprint** → apontar para o repo → aplicar. Ajustar `branch` no `render.yaml` se não usares `main`.
3. No painel do Render, preencher variáveis **sync: false**:
   - **API (`financeflow-api`):** `FRONTEND_URL` = URL pública do static (ex. `https://financeflow-web.onrender.com`), `CLERK_SECRET_KEY`, `ATTACHMENT_URL_SECRET`, `ADMIN_OPERATIONS_SECRET` (se usares POST de feature-flags), `GEMINI_API_KEY` (opcional mas recomendado para IA), `SENTRY_DSN` (opcional).
   - **Static (`financeflow-web`):** `VITE_API_URL` = URL da API **sem** `/api` no fim (ex. `https://financeflow-api.onrender.com`), `VITE_CLERK_PUBLISHABLE_KEY` = chave **live** do Clerk.
4. Depois da API estar no ar, **atualiza** `VITE_API_URL` no static (se ainda não tinhas a URL) e faz **Manual Deploy** do front — o Vite embute as env no build.
5. **Clerk:** Domínios permitidos + redirect URLs para o URL do static e (se necessário) da API.
6. **Health checks:** a API usa `GET /api/health/live` (liveness). Para readiness: `/api/health/ready`.

### Notas

- **`DISABLE_JOB_POLLER=true`** no blueprint: a API não processa fila; para jobs assíncronos, cria um segundo serviço **Background Worker** no Render com o mesmo `rootDir: backend`, comando `npm run start:worker` e as mesmas variáveis de BD (sem desativar o poller no worker).
- **Anexos / `uploads/`:** no plano gratuito o disco do container é **efémero** — reinícios podem apagar ficheiros. Para produção séria usa storage object (S3, etc.) ou disco persistente pago.
- **CORS:** `FRONTEND_URL` pode ser uma lista separada por vírgulas se tiveres mais de um origin.

### Deploy genérico (não Render)

1. PostgreSQL + `prisma migrate deploy` no arranque (ex.: `backend/scripts/render-start.sh`).
2. Backend: `npm run build` → `npm run start:prod`; probes **`/api/health/live`** e **`/api/health/ready`**.
3. Front: `npm run build` → servir `dist` com fallback SPA para `index.html`.
4. **Backup:** ver `backend/.env.example` e scripts em `backend/scripts/`.

---

## Regras de negócio (resumo)

- Valor da transação deve ser positivo; tipo da transação alinhado ao tipo da categoria.
- Dados isolados por utilizador (via Clerk + utilizador interno na BD).
- Anexos: tipos e tamanhos limitados (ver constantes no backend e `.env.example`).

---

## Licença e autor

Projeto de **portfolio**.  
**Autor:** DevJPMello

---

*Se quiseres um link para demo em produção ou badge de CI, adiciona aqui depois de publicares.*
