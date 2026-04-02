-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "isSubscription" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endpoint_metrics" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "endpoint_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_suggestion_feedbacks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "inputPattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "category_suggestion_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_transaction_hints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recurring_transaction_hints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");
CREATE INDEX "endpoint_metrics_route_createdAt_idx" ON "endpoint_metrics"("route", "createdAt");
CREATE UNIQUE INDEX "category_suggestion_feedbacks_userId_type_inputPattern_categoryId_key" ON "category_suggestion_feedbacks"("userId", "type", "inputPattern", "categoryId");
CREATE INDEX "category_suggestion_feedbacks_userId_type_inputPattern_idx" ON "category_suggestion_feedbacks"("userId", "type", "inputPattern");
CREATE INDEX "recurring_transaction_hints_userId_signature_idx" ON "recurring_transaction_hints"("userId", "signature");
CREATE INDEX "recurring_transaction_hints_transactionId_idx" ON "recurring_transaction_hints"("transactionId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category_suggestion_feedbacks" ADD CONSTRAINT "category_suggestion_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category_suggestion_feedbacks" ADD CONSTRAINT "category_suggestion_feedbacks_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_transaction_hints" ADD CONSTRAINT "recurring_transaction_hints_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
