-- AlterTable
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "userNote" TEXT;

-- AlterTable
ALTER TABLE "async_jobs" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_suggestion_dismissals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_suggestion_dismissals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_suggestion_dismissals_userId_key_key" ON "user_suggestion_dismissals"("userId", "key");
CREATE INDEX IF NOT EXISTS "user_suggestion_dismissals_userId_idx" ON "user_suggestion_dismissals"("userId");

-- Evita P3018 em produção: dados de teste (ex. e2e-user) sem linha em users impedem a FK
DELETE FROM "user_suggestion_dismissals" d WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = d."userId");

ALTER TABLE "user_suggestion_dismissals" DROP CONSTRAINT IF EXISTS "user_suggestion_dismissals_userId_fkey";
ALTER TABLE "user_suggestion_dismissals" ADD CONSTRAINT "user_suggestion_dismissals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "import_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "import_metrics_userId_createdAt_idx" ON "import_metrics"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "import_metrics_source_createdAt_idx" ON "import_metrics"("source", "createdAt");

DELETE FROM "import_metrics" m WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = m."userId");

ALTER TABLE "import_metrics" DROP CONSTRAINT IF EXISTS "import_metrics_userId_fkey";
ALTER TABLE "import_metrics" ADD CONSTRAINT "import_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
