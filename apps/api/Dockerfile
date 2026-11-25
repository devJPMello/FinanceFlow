# Build a partir da RAIZ do monorepo:  docker build -f apps/api/Dockerfile -t financeflow-api .
FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @financeflow/api --workspace @financeflow/shared --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @financeflow/shared \
 && npm run prisma:generate -w @financeflow/api \
 && npm run build -w @financeflow/api

FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
WORKDIR /app/apps/api
EXPOSE 3000
# aplica as migrações pendentes e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
