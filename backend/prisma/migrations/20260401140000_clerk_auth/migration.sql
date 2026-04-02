-- AlterTable: Clerk + password opcional para utilizadores só OAuth/Clerk
ALTER TABLE "users" ADD COLUMN "clerkId" TEXT;
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
