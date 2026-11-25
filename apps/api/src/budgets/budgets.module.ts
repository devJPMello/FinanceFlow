import { Body, Controller, Delete, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { budgetSchema, BudgetInput } from '@financeflow/shared';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.module';

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, month: string) {
    const budgets = await this.prisma.budget.findMany({ where: { userId, month }, include: { category: true } });
    const spent = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'EXPENSE', date: monthRange(month) },
      _sum: { amount: true },
    });
    return budgets.map((b) => {
      const s = Number(spent.find((x) => x.categoryId === b.categoryId)?._sum.amount ?? 0);
      const amount = Number(b.amount);
      return { id: b.id, month, category: b.category, amount, spent: s, remaining: amount - s, percent: amount ? Math.round((s / amount) * 100) : 0 };
    });
  }

  /** Orçamentos que chegaram a 80% (atenção) ou 100% (estourado) do limite. */
  async alerts(userId: string, month: string) {
    const all = await this.list(userId, month);
    return all
      .filter((b) => b.percent >= 80)
      .map((b) => ({ ...b, level: b.percent >= 100 ? ('danger' as const) : ('warning' as const) }))
      .sort((a, b) => b.percent - a.percent);
  }

  upsert(userId: string, dto: BudgetInput) {
    return this.prisma.budget.upsert({
      where: { userId_categoryId_month: { userId, categoryId: dto.categoryId, month: dto.month } },
      create: { ...dto, userId },
      update: { amount: dto.amount },
    });
  }

  async remove(userId: string, id: string) {
    await this.prisma.budget.deleteMany({ where: { id, userId } });
  }
}

@ApiTags('budgets')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetsController {
  constructor(private svc: BudgetsService) {}

  @Get() list(@CurrentUser() u: string, @Query('month') month: string) {
    return this.svc.list(u, month ?? new Date().toISOString().slice(0, 7));
  }
  @Get('alerts') alerts(@CurrentUser() u: string, @Query('month') month: string) {
    return this.svc.alerts(u, month ?? new Date().toISOString().slice(0, 7));
  }
  @Post() upsert(@CurrentUser() u: string, @Body(new ZodPipe(budgetSchema)) d: BudgetInput) { return this.svc.upsert(u, d); }
  @Delete(':id') remove(@CurrentUser() u: string, @Param('id') id: string) { return this.svc.remove(u, id); }
}

@Module({ controllers: [BudgetsController], providers: [BudgetsService] })
export class BudgetsModule {}
