import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = startDate;
      }
      if (endDate) {
        where.date.lte = endDate;
      }
    }

    // Otimização: usar aggregate ao invés de carregar todas as transações
    const [incomeResult, expenseResult, countResult] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          ...where,
          type: 'INCOME',
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          ...where,
          type: 'EXPENSE',
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.transaction.count({
        where,
      }),
    ]);

    const totalIncome = incomeResult._sum.amount || new Decimal(0);
    const totalExpense = expenseResult._sum.amount || new Decimal(0);
    const balance = new Decimal(totalIncome).sub(new Decimal(totalExpense));

    return {
      balance: balance.toNumber(),
      totalIncome: new Decimal(totalIncome).toNumber(),
      totalExpense: new Decimal(totalExpense).toNumber(),
      transactionCount: countResult,
    };
  }

  async getMonthlyData(userId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      expense: 0,
    }));

    transactions.forEach((transaction) => {
      const month = transaction.date.getMonth();
      const amount = transaction.amount.toNumber();

      if (transaction.type === 'INCOME') {
        monthlyData[month].income += amount;
      } else {
        monthlyData[month].expense += amount;
      }
    });

    return monthlyData;
  }

  async getCategoryStats(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = startDate;
      }
      if (endDate) {
        where.date.lte = endDate;
      }
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
      },
    });

    const categoryMap = new Map<string, { name: string; amount: number }>();

    transactions.forEach((transaction) => {
      const categoryId = transaction.categoryId;
      const categoryName = transaction.category.name;
      const amount = transaction.amount.toNumber();

      if (categoryMap.has(categoryId)) {
        const existing = categoryMap.get(categoryId)!;
        existing.amount += amount;
      } else {
        categoryMap.set(categoryId, { name: categoryName, amount });
      }
    });

    return Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);
  }
}
