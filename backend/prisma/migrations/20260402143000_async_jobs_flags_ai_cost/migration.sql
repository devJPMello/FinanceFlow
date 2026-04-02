-- CreateTable
CREATE TABLE "feature_flags" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "rolloutPct" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "tokensIn" INTEGER NOT NULL DEFAULT 0,
  "tokensOut" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
  "periodDay" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_cached_responses" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "responseJson" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_cached_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "async_jobs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "payloadJson" JSONB NOT NULL,
  "resultJson" JSONB,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "async_jobs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");
CREATE INDEX "ai_usage_userId_periodDay_idx" ON "ai_usage"("userId", "periodDay");
CREATE UNIQUE INDEX "ai_cached_responses_userId_cacheKey_route_key" ON "ai_cached_responses"("userId", "cacheKey", "route");
CREATE INDEX "ai_cached_responses_expiresAt_idx" ON "ai_cached_responses"("expiresAt");
CREATE INDEX "async_jobs_status_createdAt_idx" ON "async_jobs"("status", "createdAt");
CREATE INDEX "async_jobs_userId_createdAt_idx" ON "async_jobs"("userId", "createdAt");

-- Foreign keys
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_cached_responses" ADD CONSTRAINT "ai_cached_responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "async_jobs" ADD CONSTRAINT "async_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
