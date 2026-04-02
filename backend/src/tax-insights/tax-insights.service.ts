import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaxInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getYearSummary(userId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));

    const agg = await this.prisma.transaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        deductiblePotential: true,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const total = agg._sum.amount?.toNumber() ?? 0;

    return {
      year: y,
      totalPotentialDeductibleExpenses: total,
      flaggedExpenseCount: agg._count._all,
      disclaimer:
        'Valores são informativos com base nas despesas que você marcou como potencial dedução. ' +
        'Não configuram ajuste automático no IR nem substituem contador ou legislação.',
    };
  }
}
