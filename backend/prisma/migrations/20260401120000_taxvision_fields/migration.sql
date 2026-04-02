-- AlterTable
ALTER TABLE "categories" ADD COLUMN "suggestTaxDeductible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "bankMemo" TEXT;
ALTER TABLE "transactions" ADD COLUMN "deductiblePotential" BOOLEAN NOT NULL DEFAULT false;
