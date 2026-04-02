import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>) {
    const cached = await this.cacheManager.get<T>(key);
    if (cached !== undefined && cached !== null) return cached;
    const data = await factory();
    await this.cacheManager.set(key, data, ttlMs);
    return data;
  }
  private parseMonth(month?: string) {
    const normalized = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
    return normalized ?? new Date().toISOString().slice(0, 7);
  }

  async getSummary(userId: string, startDate?: Date, endDate?: Date) {
    const cacheKey = `dashboard:summary:${userId}:${startDate?.toISOString() || '-'}:${endDate?.toISOString() || '-'}`;
    return this.getOrSet(cacheKey, 120000, async () => {
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
    });
  }

  async getMonthlyData(userId: string, year: number) {
    const cacheKey = `dashboard:monthly:${userId}:${year}`;
    return this.getOrSet(cacheKey, 300000, async () => {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

      const rows = await this.prisma.$queryRaw<
        Array<{ m: number; typ: string; total: Prisma.Decimal }>
      >(Prisma.sql`
        SELECT EXTRACT(MONTH FROM date)::int AS m,
               type::text AS typ,
               COALESCE(SUM(amount), 0) AS total
        FROM "transactions"
        WHERE "userId" = ${userId}
          AND date >= ${startDate}
          AND date <= ${endDate}
        GROUP BY EXTRACT(MONTH FROM date), type
        ORDER BY m
      `);

      const monthlyData = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        income: 0,
        expense: 0,
      }));

      for (const r of rows) {
        const idx = Number(r.m) - 1;
        if (idx < 0 || idx > 11) continue;
        const val = new Decimal(r.total).toNumber();
        if (r.typ === 'INCOME') {
          monthlyData[idx].income += val;
        } else if (r.typ === 'EXPENSE') {
          monthlyData[idx].expense += val;
        }
      }

      return monthlyData;
    });
  }

  async getCategoryStats(userId: string, startDate?: Date, endDate?: Date) {
    const cacheKey = `dashboard:categories:${userId}:${startDate?.toISOString() || '-'}:${endDate?.toISOString() || '-'}`;
    return this.getOrSet(cacheKey, 300000, async () => {
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

    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
    });

    if (grouped.length === 0) {
      return [];
    }

    const categories = await this.prisma.category.findMany({
      where: { userId, id: { in: grouped.map((g) => g.categoryId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return grouped
      .map((g) => ({
        name: nameById.get(g.categoryId) || '—',
        amount: new Decimal(g._sum.amount ?? 0).toNumber(),
      }))
      .filter((r) => r.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    });
  }

  async getMonthSummary(userId: string, month?: string) {
    const monthKey = this.parseMonth(month);
    const cacheKey = `dashboard:month-summary:${userId}:${monthKey}`;
    return this.getOrSet(cacheKey, 120000, async () => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const monthNumber = Number(monthStr);

    const currentStart = new Date(year, monthNumber - 1, 1);
    const currentEnd = new Date(year, monthNumber, 0, 23, 59, 59, 999);
    const prevStart = new Date(year, monthNumber - 2, 1);
    const prevEnd = new Date(year, monthNumber - 1, 0, 23, 59, 59, 999);

    const [current, previous] = await Promise.all([
      this.getSummary(userId, currentStart, currentEnd),
      this.getSummary(userId, prevStart, prevEnd),
    ]);

    const previousBalance = previous.balance || 0;
    const variation =
      previousBalance === 0 ? null : ((current.balance - previousBalance) / Math.abs(previousBalance)) * 100;

      return {
        month: monthKey,
        ...current,
        previousMonthBalance: previousBalance,
        balanceVariationPercent: variation,
      };
    });
  }

  async getPendingPanel(userId: string) {
    const cacheKey = `dashboard:pending:${userId}`;
    return this.getOrSet(cacheKey, 45000, async () => {
      const now = new Date();

    const [withoutAttachment, overdueGoalRows] = await Promise.all([
      this.prisma.transaction.count({
        where: {
          userId,
          attachments: { none: {} },
        },
      }),
      this.prisma.goal.findMany({
        where: {
          userId,
          deadline: { lt: now },
        },
        select: { targetAmount: true, currentAmount: true },
      }),
    ]);

    const overdueGoals = overdueGoalRows.filter((goal) => goal.currentAmount.lt(goal.targetAmount)).length;

    const reviewWindowStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [fiscalPending, withoutDescription] = await Promise.all([
      this.prisma.transaction.count({
        where: {
          userId,
          date: { gte: reviewWindowStart },
          type: 'EXPENSE',
          attachments: { none: {} },
        },
      }),
      this.prisma.transaction.count({
        where: {
          userId,
          OR: [{ description: null }, { description: '' }],
        },
      }),
    ]);

      return {
        total: withoutAttachment + overdueGoals + fiscalPending + withoutDescription,
        items: [
          {
            id: 'without-description',
            label: 'Lançamentos sem descrição',
            count: withoutDescription,
            actionPath: '/transactions',
          },
          { id: 'without-attachment', label: 'Transações sem anexo', count: withoutAttachment, actionPath: '/transactions#import' },
          { id: 'overdue-goal', label: 'Metas atrasadas', count: overdueGoals, actionPath: '/goals' },
          { id: 'fiscal-review', label: 'Revisão fiscal pendente', count: fiscalPending, actionPath: '/tax-vision' },
        ],
      };
    });
  }

  async getBudgetOverview(userId: string, month?: string) {
    const monthKey = this.parseMonth(month);
    const cacheKey = `dashboard:budget:${userId}:${monthKey}`;
    return this.getOrSet(cacheKey, 60000, async () => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const monthNumber = Number(monthStr);
    const now = new Date();
    const totalDays = new Date(year, monthNumber, 0).getDate();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === monthNumber;
    const elapsedDays = isCurrentMonth ? Math.max(now.getDate(), 1) : totalDays;

    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 0, 23, 59, 59, 999);

    const [budgets, spentRows] = await Promise.all([
      this.prisma.categoryBudget.findMany({
        where: { userId, month: monthKey },
        include: {
          category: { select: { id: true, name: true, color: true } },
        },
        orderBy: { category: { name: 'asc' } },
      }),
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { userId, type: 'EXPENSE', date: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
    ]);

    const spentMap = new Map<string, number>(
      spentRows.map((row) => [row.categoryId, Number(row._sum.amount?.toString() ?? 0)]),
    );
    const rows = budgets.map((b) => {
      const spent = spentMap.get(b.categoryId) ?? 0;
      const limit = b.limit.toNumber();
      const usage = limit > 0 ? (spent / limit) * 100 : 0;
      const projected = elapsedDays > 0 ? (spent / elapsedDays) * totalDays : 0;
      const projectedUsage = limit > 0 ? (projected / limit) * 100 : 0;
      const status = projectedUsage >= 100 ? 'red' : projectedUsage >= 85 ? 'yellow' : 'green';
      return {
        categoryId: b.categoryId,
        categoryName: b.category.name,
        color: b.category.color,
        limit,
        spent,
        usagePercent: usage,
        projectedSpent: projected,
        projectedUsagePercent: projectedUsage,
        status,
      };
    });

      return rows.sort((a, b) => b.projectedUsagePercent - a.projectedUsagePercent);
    });
  }

  async getMonthlyClosing(userId: string, month?: string) {
    const monthKey = this.parseMonth(month);
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const monthNumber = Number(monthStr);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 0, 23, 59, 59, 999);
    const now = new Date();

    const [
      monthTransactionCount,
      withoutDescription,
      withoutAttachment,
      fiscalFlaggedNoDoc,
      overdueGoalRows,
    ] = await Promise.all([
      this.prisma.transaction.count({
        where: { userId, date: { gte: start, lte: end } },
      }),
      this.prisma.transaction.count({
        where: {
          userId,
          date: { gte: start, lte: end },
          OR: [{ description: null }, { description: '' }],
        },
      }),
      this.prisma.transaction.count({
        where: {
          userId,
          date: { gte: start, lte: end },
          attachments: { none: {} },
        },
      }),
      this.prisma.transaction.count({
        where: {
          userId,
          type: 'EXPENSE',
          deductiblePotential: true,
          date: { gte: start, lte: end },
          attachments: { none: {} },
        },
      }),
      this.prisma.goal.findMany({
        where: { userId, deadline: { lt: now } },
        select: { targetAmount: true, currentAmount: true },
      }),
    ]);

    const overdueGoals = overdueGoalRows.filter((g) =>
      g.currentAmount.lt(g.targetAmount),
    ).length;

    const monthHasMovements = monthTransactionCount > 0;

    const steps = [
      {
        key: 'review-details',
        title: 'Revisar lançamentos do mês',
        detail: 'Descrições vazias ou incompletas',
        count: withoutDescription,
        actionPath: '/transactions',
        applicable: monthHasMovements,
        done: monthHasMovements && withoutDescription === 0,
      },
      {
        key: 'attachments',
        title: 'Anexar comprovantes',
        detail: 'Lançamentos do mês sem anexo no baú fiscal',
        count: withoutAttachment,
        actionPath: '/transactions#import',
        applicable: monthHasMovements,
        done: monthHasMovements && withoutAttachment === 0,
      },
      {
        key: 'fiscal-flags',
        title: 'Marcar e documentar IR',
        detail: 'Potencial IR sem comprovante no período',
        count: fiscalFlaggedNoDoc,
        actionPath: '/tax-vision',
        applicable: monthHasMovements,
        done: monthHasMovements && fiscalFlaggedNoDoc === 0,
      },
      {
        key: 'goals',
        title: 'Metas atrasadas',
        detail: 'Metas com prazo vencido e valor abaixo da meta',
        count: overdueGoals,
        actionPath: '/goals',
        applicable: true,
        done: overdueGoals === 0,
      },
      {
        key: 'export',
        title: 'Exportar pacote ao contador',
        detail: 'Gerar ZIP com CSV, resumo e anexos (TaxVision)',
        count: 0,
        actionPath: '/tax-vision',
        applicable: true,
        done: false,
      },
    ];

    const scoringTotal = 4;
    let completed = 0;
    if (monthHasMovements) {
      if (withoutDescription === 0) completed++;
      if (withoutAttachment === 0) completed++;
      if (fiscalFlaggedNoDoc === 0) completed++;
    }
    if (overdueGoals === 0) completed++;

    return {
      month: monthKey,
      monthTransactionCount,
      completedSteps: completed,
      totalSteps: steps.length,
      percent: Math.round((completed / scoringTotal) * 100),
      steps,
    };
  }
}
