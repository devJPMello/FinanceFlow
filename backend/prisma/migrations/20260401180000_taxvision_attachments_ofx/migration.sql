-- CreateTable
CREATE TABLE "transaction_attachments" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_attachments_transactionId_idx" ON "transaction_attachments"("transactionId");

-- AddForeignKey
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
