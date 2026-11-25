import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const hash = (acc: string, date: string, amount: number, desc: string) =>
  createHash('sha1').update([acc, date, amount.toFixed(2), desc.toLowerCase()].join('|')).digest('hex');

async function main() {
  const email = 'demo@financeflow.dev';
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({
    data: {
      name: 'Demo', email, passwordHash: await bcrypt.hash('demo12345', 10),
      accounts: { create: { name: 'Conta principal', type: 'CHECKING', initialBalance: 1000 } },
      categories: {
        create: [
          { name: 'Alimentação', kind: 'EXPENSE', color: '#f97316' },
          { name: 'Transporte', kind: 'EXPENSE', color: '#0ea5e9' },
          { name: 'Lazer', kind: 'EXPENSE', color: '#a855f7' },
          { name: 'Salário', kind: 'INCOME', color: '#22c55e' },
        ],
      },
    },
    include: { accounts: true, categories: true },
  });
  const acc = user.accounts[0];
  const cat = (n: string) => user.categories.find((c) => c.name === n)!.id;
  const month = new Date().toISOString().slice(0, 7);
  const items: [string, number, string, 'INCOME' | 'EXPENSE', string][] = [
    ['01', 5000, 'Salário', 'INCOME', 'Salário'],
    ['03', 320.9, 'Supermercado', 'EXPENSE', 'Alimentação'],
    ['05', 45, 'Uber', 'EXPENSE', 'Transporte'],
    ['08', 89.9, 'Cinema e jantar', 'EXPENSE', 'Lazer'],
  ];
  for (const [d, amount, description, type, c] of items) {
    const date = `${month}-${d}`;
    await prisma.transaction.create({
      data: {
        userId: user.id, accountId: acc.id, categoryId: cat(c), type, amount, description,
        date: new Date(date), hash: hash(acc.id, date, amount, description),
      },
    });
  }
  console.log(`Seed ok → ${email} / demo12345`);
}

main().finally(() => prisma.$disconnect());
