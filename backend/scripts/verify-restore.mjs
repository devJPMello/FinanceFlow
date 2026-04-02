import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [users, txs, categories] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.category.count(),
  ]);
  console.log(
    JSON.stringify(
      {
        ok: true,
        counts: { users, transactions: txs, categories },
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
