import { Body, Controller, Delete, Get, Header, Injectable, Module, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { transactionSchema, TransactionInput } from '@financeflow/shared';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { removeFiles } from '../attachments/storage';
import { PrismaService } from '../prisma/prisma.module';

export function normalizeDescription(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Soma meses a uma data ISO mantendo o dia (ajusta para o último dia do mês quando preciso). */
export function addMonthsIso(d: Date, n: number) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last))).toISOString().slice(0, 10);
}

export function txHash(accountId: string, date: string, amount: number, description: string) {
  return createHash('sha1')
    .update([accountId, date, amount.toFixed(2), normalizeDescription(description)].join('|'))
    .digest('hex');
}

interface ListQuery {
  from?: string; to?: string; accountId?: string; categoryId?: string;
  type?: string; q?: string; tag?: string; paymentMethod?: string; page?: string; pageSize?: string;
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  private where(userId: string, f: ListQuery): Prisma.TransactionWhereInput {
    return {
      userId,
      ...(f.accountId && { accountId: f.accountId }),
      ...(f.categoryId && { categoryId: f.categoryId }),
      ...(f.type && { type: f.type as any }),
      ...(f.q && { description: { contains: f.q, mode: 'insensitive' } }),
      ...(f.tag && { tags: { has: f.tag } }),
      ...(f.paymentMethod && { paymentMethod: f.paymentMethod as any }),
      ...((f.from || f.to) && {
        date: { ...(f.from && { gte: new Date(f.from) }), ...(f.to && { lte: new Date(f.to) }) },
      }),
    };
  }

  async list(userId: string, f: ListQuery) {
    const page = Math.max(1, Number(f.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(f.pageSize ?? 20)));
    const where = this.where(userId, f);
    const [items, total, agg] = await Promise.all([
      this.prisma.transaction.findMany({
        where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize, take: pageSize,
        include: { category: true, account: { select: { id: true, name: true } }, attachments: { select: { id: true, fileName: true, mime: true, size: true } } },
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.groupBy({ by: ['type'], where, _sum: { amount: true } }),
    ]);
    const sum = (t: string) => Number(agg.find((a) => a.type === t)?._sum.amount ?? 0);
    return {
      items: items.map((t) => ({ ...t, amount: Number(t.amount) })),
      total, page, pageSize,
      totals: { income: sum('INCOME'), expense: sum('EXPENSE') },
    };
  }

  async create(userId: string, dto: TransactionInput) {
    await this.checkRefs(userId, dto);
    const { installments, ...base } = dto;
    const total = installments && installments > 1 ? installments : 1;
    const first = new Date(dto.date);
    const make = (i: number) => {
      const date = total === 1 ? dto.date : addMonthsIso(first, i);
      const description = total === 1 ? dto.description : `${dto.description} (${i + 1}/${total})`;
      return {
        ...base, userId, description, categoryId: dto.categoryId || null, tags: dto.tags ?? [], paymentMethod: dto.paymentMethod ?? null, date: new Date(date),
        installmentNo: total === 1 ? null : i + 1, installmentTotal: total === 1 ? null : total,
        hash: txHash(dto.accountId, date, dto.amount, description),
      };
    };
    const created = await this.prisma.$transaction(Array.from({ length: total }, (_, i) => this.prisma.transaction.create({ data: make(i) })));
    return { ...created[0], amount: Number(created[0].amount), created: created.length };
  }

  async update(userId: string, id: string, dto: TransactionInput) {
    if (!(await this.prisma.transaction.findFirst({ where: { id, userId } }))) throw new NotFoundException();
    await this.checkRefs(userId, dto);
    const { installments: _ignored, ...base } = dto;
    const t = await this.prisma.transaction.update({
      where: { id },
      data: { ...base, tags: dto.tags ?? [], paymentMethod: dto.paymentMethod ?? null, categoryId: dto.categoryId || null, date: new Date(dto.date), hash: txHash(dto.accountId, dto.date, dto.amount, dto.description) },
    });
    return { ...t, amount: Number(t.amount) };
  }

  async remove(userId: string, id: string) {
    const files = await this.prisma.attachment.findMany({ where: { userId, transactionId: id }, select: { id: true } });
    const r = await this.prisma.transaction.deleteMany({ where: { id, userId } });
    if (!r.count) throw new NotFoundException();
    await removeFiles(userId, files.map((f) => f.id));
  }

  async tags(userId: string) {
    const rows = await this.prisma.$queryRaw<{ tag: string }[]>`SELECT DISTINCT unnest(tags) AS tag FROM "Transaction" WHERE "userId" = ${userId} ORDER BY 1`;
    return rows.map((r) => r.tag);
  }

  async bulkCategory(userId: string, ids: string[], categoryId: string | null) {
    return this.prisma.transaction.updateMany({ where: { userId, id: { in: ids } }, data: { categoryId } });
  }

  async exportCsv(userId: string, f: ListQuery) {
    const rows = await this.prisma.transaction.findMany({
      where: this.where(userId, f), orderBy: { date: 'desc' }, include: { category: true, account: true },
    });
    const esc = (v: string) => '"' + v.replace(/"/g, '""') + '"';
    const lines = rows.map((t) =>
      [t.date.toISOString().slice(0, 10), esc(t.description), t.type, Number(t.amount).toFixed(2), esc(t.category?.name ?? ''), esc(t.account.name), t.paymentMethod ?? ''].join(';'),
    );
    return ['data;descricao;tipo;valor;categoria;conta;pagamento', ...lines].join('\n');
  }

  private async checkRefs(userId: string, dto: TransactionInput) {
    if (!(await this.prisma.account.findFirst({ where: { id: dto.accountId, userId } }))) throw new NotFoundException('Conta não encontrada');
    if (dto.categoryId && !(await this.prisma.category.findFirst({ where: { id: dto.categoryId, userId } }))) {
      throw new NotFoundException('Categoria não encontrada');
    }
  }
}

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private svc: TransactionsService) {}

  @Get() list(@CurrentUser() u: string, @Query() q: ListQuery) { return this.svc.list(u, q); }

  @Get('tags') tags(@CurrentUser() u: string) { return this.svc.tags(u); }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="transacoes.csv"')
  export(@CurrentUser() u: string, @Query() q: ListQuery) { return this.svc.exportCsv(u, q); }

  @Post() create(@CurrentUser() u: string, @Body(new ZodPipe(transactionSchema)) d: TransactionInput) { return this.svc.create(u, d); }

  @Put(':id') update(@CurrentUser() u: string, @Param('id') id: string, @Body(new ZodPipe(transactionSchema)) d: TransactionInput) { return this.svc.update(u, id, d); }

  @Post('bulk-category') bulk(@CurrentUser() u: string, @Body() b: { ids: string[]; categoryId: string | null }) {
    return this.svc.bulkCategory(u, b.ids ?? [], b.categoryId ?? null);
  }

  @Delete(':id') remove(@CurrentUser() u: string, @Param('id') id: string) { return this.svc.remove(u, id); }
}

@Module({ controllers: [TransactionsController], providers: [TransactionsService], exports: [TransactionsService] })
export class TransactionsModule {}
