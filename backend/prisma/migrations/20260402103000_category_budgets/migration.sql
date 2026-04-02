-- CreateTable
CREATE TABLE "category_budgets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "limit" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_budgets_userId_month_idx" ON "category_budgets"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "category_budgets_userId_categoryId_month_key" ON "category_budgets"("userId", "categoryId", "month");

-- AddForeignKey
ALTER TABLE "category_budgets" ADD CONSTRAINT "category_budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_budgets" ADD CONSTRAINT "category_budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
