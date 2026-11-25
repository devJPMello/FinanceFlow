import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { recurringSchema, RecurringInput } from '@financeflow/shared';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.module';
import { addMonthsIso, txHash } from '../transactions/transactions.module';

type Freq = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** Data da n-ésima ocorrência (n começa em 0), ancorada no dia da data inicial. */
export function occurrence(start: Date, freq: Freq, n: number): Date {
  if (freq === 'WEEKLY') return new Date(start.getTime() + n * 7 * 86_400_000);
  return new Date(addMonthsIso(start, freq === 'MONTHLY' ? n : n * 12));
}

const MAX_CATCH_UP = 120; // limite de segurança por regra a cada execução

@Injectable()
export class RecurringService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.recurringRule.findMany({
      where: { userId }, orderBy: [{ active: 'desc' }, { nextDate: 'asc' }],
      include: { category: true, account: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }

  async create(userId: string, dto: RecurringInput) {
    await this.checkRefs(userId, dto);
    const start = new Date(dto.startDate);
    const r = await this.prisma.recurringRule.create({
      data: {
        userId, accountId: dto.accountId, categoryId: dto.categoryId || null, type: dto.type, amount: dto.amount,
        description: dto.description, paymentMethod: dto.paymentMethod ?? null, frequency: dto.frequency, startDate: start, endDate: dto.endDate ? new Date(dto.endDate) : null, nextDate: start,
      },
    });
    await this.generateDue(userId);
    const fresh = await this.prisma.recurringRule.findUniqueOrThrow({ where: { id: r.id } });
    return { ...fresh, amount: Number(fresh.amount) };
  }

  async update(userId: string, id: string, dto: RecurringInput) {
    const cur = await this.prisma.recurringRule.findFirst({ where: { id, userId } });
    if (!cur) throw new NotFoundException();
    await this.checkRefs(userId, dto);
    const start = new Date(dto.startDate);
    const r = await this.prisma.recurringRule.update({
      where: { id },
      data: {
        accountId: dto.accountId, categoryId: dto.categoryId || null, type: dto.type, amount: dto.amount, description: dto.description, paymentMethod: dto.paymentMethod ?? null,
        frequency: dto.frequency, startDate: start, endDate: dto.endDate ? new Date(dto.endDate) : null,
        // recalcula a próxima ocorrência a partir do que já foi gerado
        nextDate: occurrence(start, dto.frequency, cur.generatedCount),
      },
    });
    return { ...r, amount: Number(r.amount) };
  }

  async setActive(userId: string, id: string, active: boolean) {
    const r = await this.prisma.recurringRule.updateMany({ where: { id, userId }, data: { active } });
    if (!r.count) throw new NotFoundException();
    if (active) await this.generateDue(userId);
  }

  async remove(userId: string, id: string) {
    const r = await this.prisma.recurringRule.deleteMany({ where: { id, userId } });
    if (!r.count) throw new NotFoundException();
  }

  /** Gera as transações vencidas (até hoje) de todas as regras ativas. Idempotente. */
  async generateDue(userId: string) {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const rules = await this.prisma.recurringRule.findMany({ where: { userId, active: true, nextDate: { lte: today } } });
    let created = 0;
    for (const rule of rules) {
      let count = rule.generatedCount;
      for (let i = 0; i < MAX_CATCH_UP; i++) {
        const date = occurrence(rule.startDate, rule.frequency, count);
        if (date > today) break;
        if (rule.endDate && date > rule.endDate) break;
        const next = occurrence(rule.startDate, rule.frequency, count + 1);
        const iso = date.toISOString().slice(0, 10);
        const done = await this.prisma.$transaction(async (tx) => {
          // trava otimista: só avança se ninguém gerou esta ocorrência antes
          const claimed = await tx.recurringRule.updateMany({
            where: { id: rule.id, generatedCount: count },
            data: { generatedCount: count + 1, nextDate: next, active: !(rule.endDate && next > rule.endDate) },
          });
          if (!claimed.count) return false;
          await tx.transaction.create({
            data: {
              userId, accountId: rule.accountId, categoryId: rule.categoryId, type: rule.type, amount: rule.amount, date,
              description: rule.description, paymentMethod: rule.paymentMethod, recurringId: rule.id, hash: txHash(rule.accountId, iso, Number(rule.amount), rule.description),
            },
          });
          return true;
        });
        if (!done) break;
        created++;
        count++;
      }
    }
    return { created };
  }

  private async checkRefs(userId: string, dto: RecurringInput) {
    if (!(await this.prisma.account.findFirst({ where: { id: dto.accountId, userId } }))) throw new NotFoundException('Conta não encontrada');
    if (dto.categoryId && !(await this.prisma.category.findFirst({ where: { id: dto.categoryId, userId } }))) throw new NotFoundException('Categoria não encontrada');
  }
}

@ApiTags('recurring')
@ApiBearerAuth()
@Controller('recurring')
export class RecurringController {
  constructor(private svc: RecurringService) {}

  @Get() list(@CurrentUser() u: string) { return this.svc.list(u); }
  @Post() create(@CurrentUser() u: string, @Body(new ZodPipe(recurringSchema)) d: RecurringInput) { return this.svc.create(u, d); }
  @Post('run') @HttpCode(200) run(@CurrentUser() u: string) { return this.svc.generateDue(u); }
  @Put(':id') update(@CurrentUser() u: string, @Param('id') id: string, @Body(new ZodPipe(recurringSchema)) d: RecurringInput) { return this.svc.update(u, id, d); }
  @Patch(':id/active') active(@CurrentUser() u: string, @Param('id') id: string, @Body('active') active: boolean) { return this.svc.setActive(u, id, !!active); }
  @Delete(':id') remove(@CurrentUser() u: string, @Param('id') id: string) { return this.svc.remove(u, id); }
}

@Module({ controllers: [RecurringController], providers: [RecurringService] })
export class RecurringModule {}
