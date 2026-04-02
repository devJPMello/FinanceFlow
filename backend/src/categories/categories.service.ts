import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Decimal } from '@prisma/client/runtime/library';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpsertCategoryBudgetDto } from './dto/upsert-category-budget.dto';
import { AuditService } from '../common/services/audit.service';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async invalidateDashboardCache() {
    const manager = this.cacheManager as Cache & { reset?: () => Promise<void> };
    if (typeof manager.reset === 'function') {
      await manager.reset();
    }
  }

  async create(userId: string, createCategoryDto: CreateCategoryDto) {
    const created = await this.prisma.category.create({
      data: {
        ...createCategoryDto,
        userId,
        color: createCategoryDto.color || '#6366f1',
      },
    });
    await this.invalidateDashboardCache();
    return created;
  }

  async findAll(userId: string, query?: { type?: string; page?: number; limit?: number }) {
    const where: any = { userId };

    if (query?.type && (query.type === 'INCOME' || query.type === 'EXPENSE')) {
      where.type = query.type;
    }

    // Paginação
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    if (category.userId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }

    return category;
  }

  async update(userId: string, id: string, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(userId, id);

    const before = await this.findOne(userId, id);
    const updated = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
    if (
      updateCategoryDto.suggestTaxDeductible !== undefined &&
      before.suggestTaxDeductible !== updated.suggestTaxDeductible
    ) {
      await this.auditService.log({
        userId,
        actorUserId: userId,
        entity: 'category',
        entityId: id,
        action: 'update-tax-suggestion',
        beforeJson: { suggestTaxDeductible: before.suggestTaxDeductible },
        afterJson: { suggestTaxDeductible: updated.suggestTaxDeductible },
      });
    }
    await this.invalidateDashboardCache();
    return updated;
  }

  async remove(userId: string, id: string) {
    const category = await this.findOne(userId, id);

    // Regra de negócio: Não pode remover categoria com transações vinculadas
    if (category._count.transactions > 0) {
      throw new BadRequestException(
        'Não é possível remover categoria com transações vinculadas',
      );
    }

    const removed = await this.prisma.category.delete({
      where: { id },
    });
    await this.invalidateDashboardCache();
    return removed;
  }

  /** Previsão simples: média mensal por categoria (últimos 3 meses) → projeção próximo mês. */
  async getExpenseForecast(userId: string) {
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const txs = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: start },
      },
      select: {
        categoryId: true,
        amount: true,
        date: true,
        category: { select: { name: true, color: true } },
      },
    });

    const byCat = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        color: string | null;
        months: Set<string>;
        total: Decimal;
        count: number;
      }
    >();

    for (const t of txs) {
      const key = t.categoryId;
      if (!byCat.has(key)) {
        byCat.set(key, {
          categoryId: key,
          categoryName: t.category.name,
          color: t.category.color,
          months: new Set(),
          total: new Decimal(0),
          count: 0,
        });
      }
      const agg = byCat.get(key)!;
      agg.months.add(`${t.date.getFullYear()}-${t.date.getMonth()}`);
      agg.total = agg.total.add(t.amount);
      agg.count += 1;
    }

    const rows = Array.from(byCat.values()).map((a) => {
      const monthCount = Math.max(a.months.size, 1);
      const avg = a.total.div(monthCount);
      const projected = avg.toNumber();
      return {
        categoryId: a.categoryId,
        categoryName: a.categoryName,
        color: a.color,
        totalInPeriod: a.total.toNumber(),
        monthsWithMovement: a.months.size,
        averageMonthlyExpense: avg.toNumber(),
        projectedNextMonthExpense: projected,
        transactionCount: a.count,
      };
    });

    rows.sort((x, y) => y.projectedNextMonthExpense - x.projectedNextMonthExpense);
    return rows;
  }

  async upsertMonthlyBudget(userId: string, dto: UpsertCategoryBudgetDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, userId: true, type: true },
    });

    if (!category || category.userId !== userId) {
      throw new NotFoundException('Categoria não encontrada');
    }

    if (category.type !== 'EXPENSE') {
      throw new BadRequestException('Orçamento mensal só pode ser aplicado em categorias de despesa');
    }

    const row = await this.prisma.categoryBudget.upsert({
      where: {
        userId_categoryId_month: {
          userId,
          categoryId: dto.categoryId,
          month: dto.month,
        },
      },
      update: { limit: new Decimal(dto.limit) },
      create: {
        userId,
        categoryId: dto.categoryId,
        month: dto.month,
        limit: new Decimal(dto.limit),
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });
    await this.invalidateDashboardCache();
    return row;
  }

  async listMonthlyBudgets(userId: string, month: string) {
    return this.prisma.categoryBudget.findMany({
      where: { userId, month },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { category: { name: 'asc' } },
    });
  }
}
