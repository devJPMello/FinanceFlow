import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private range(from?: string, to?: string) {
    const now = new Date();
    const start = from ? new Date(from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = to ? new Date(to) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return { gte: start, lte: end };
  }

  async summary(userId: string, from?: string, to?: string) {
    const date = this.range(from, to);
    const [byType, byCategory, topExpenses] = await Promise.all([
      this.prisma.transaction.groupBy({ by: ['type'], where: { userId, date }, _sum: { amount: true } }),
      this.prisma.transaction.groupBy({
        by: ['categoryId'], where: { userId, date, type: 'EXPENSE' }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } },
      }),
      this.prisma.transaction.findMany({
        where: { userId, date, type: 'EXPENSE' }, orderBy: { amount: 'desc' }, take: 5, include: { category: true },
      }),
    ]);
    const cats = await this.prisma.category.findMany({ where: { userId } });
    const sum = (t: string) => Number(byType.find((x) => x.type === t)?._sum.amount ?? 0);
    const income = sum('INCOME');
    const expense = sum('EXPENSE');
    return {
      income, expense, balance: income - expense,
      byCategory: byCategory.map((b) => {
        const c = cats.find((x) => x.id === b.categoryId);
        return { categoryId: b.categoryId, name: c?.name ?? 'Sem categoria', color: c?.color ?? '#94a3b8', total: Number(b._sum.amount ?? 0) };
      }),
      topExpenses: topExpenses.map((t) => ({ id: t.id, description: t.description, amount: Number(t.amount), date: t.date, category: t.category?.name ?? null })),
    };
  }

  async cashflow(userId: string, months = 6) {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
    const rows = await this.prisma.$queryRaw<{ month: string; type: string; total: unknown }[]>`
      SELECT to_char(date, 'YYYY-MM') AS month, type::text AS type, SUM(amount) AS total
      FROM "Transaction"
      WHERE "userId" = ${userId} AND date >= ${start}::date
      GROUP BY 1, 2 ORDER BY 1`;
    const map = new Map<string, { month: string; income: number; expense: number }>();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = d.toISOString().slice(0, 7);
      map.set(key, { month: key, income: 0, expense: 0 });
    }
    for (const r of rows) {
      const e = map.get(r.month);
      if (!e) continue;
      if (r.type === 'INCOME') e.income = Number(r.total);
      if (r.type === 'EXPENSE') e.expense = Number(r.total);
    }
    return [...map.values()];
  }
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @Get('summary') summary(@CurrentUser() u: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.summary(u, from, to);
  }
  @Get('cashflow') cashflow(@CurrentUser() u: string, @Query('months') months?: string) {
    return this.svc.cashflow(u, Math.min(24, Number(months ?? 6)));
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
