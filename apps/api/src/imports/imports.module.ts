import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param,
  Patch, Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { z } from 'zod';
import { ImportMapping } from '@financeflow/shared';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.module';
import { normalizeDescription, txHash } from '../transactions/transactions.module';
import { normalizeRows, OFX_MAPPING, parseCsv, parseOfx, parseXlsx, RawTable } from './parsers';

const mappingSchema = z.object({
  accountId: z.string().min(1),
  mapping: z.object({
    date: z.string().min(1),
    description: z.string().min(1),
    amount: z.string().optional(),
    credit: z.string().optional(),
    debit: z.string().optional(),
    dateFormat: z.enum(['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY']),
    decimal: z.enum([',', '.']),
    invertSign: z.boolean().optional(),
  }).refine((m) => m.amount || m.credit || m.debit, { message: 'Informe a coluna de valor' }),
});
type MappingInput = z.infer<typeof mappingSchema>;

const rowPatchSchema = z.object({ categoryId: z.string().nullable().optional(), skip: z.boolean().optional() });

const EXT_FORMAT: Record<string, 'CSV' | 'XLSX' | 'OFX'> = { '.csv': 'CSV', '.txt': 'CSV', '.xlsx': 'XLSX', '.ofx': 'OFX' };

@Injectable()
export class ImportsService {
  constructor(private prisma: PrismaService) {}

  async upload(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    const format = EXT_FORMAT[extname(file.originalname).toLowerCase()];
    if (!format) throw new BadRequestException('Formato não suportado. Use CSV, XLSX ou OFX.');
    let table: RawTable;
    try {
      table = format === 'CSV' ? parseCsv(file.buffer) : format === 'XLSX' ? await parseXlsx(file.buffer) : parseOfx(file.buffer);
    } catch {
      throw new BadRequestException('Não foi possível ler o arquivo');
    }
    if (!table.rows.length) throw new BadRequestException('Nenhuma linha encontrada no arquivo');
    const batch = await this.prisma.importBatch.create({
      data: {
        userId, format, fileName: file.originalname, rawRows: table as unknown as Prisma.InputJsonValue, totalRows: table.rows.length,
      },
    });
    return {
      id: batch.id, format, fileName: batch.fileName, totalRows: table.rows.length,
      columns: table.columns, sample: table.rows.slice(0, 5),
      suggestedMapping: format === 'OFX' ? OFX_MAPPING : this.suggest(table.columns),
    };
  }

  /** Heurística simples para pré-selecionar colunas. */
  private suggest(columns: string[]): Partial<ImportMapping> {
    const find = (re: RegExp) => columns.find((c) => re.test(c.toLowerCase()));
    return {
      date: find(/data|date/),
      description: find(/descri|hist|memo|estabelec|lan[cç]amento|title/),
      amount: find(/valor|amount|quantia/),
      dateFormat: 'DD/MM/YYYY',
      decimal: ',',
    };
  }

  async applyMapping(userId: string, id: string, dto: MappingInput) {
    const batch = await this.ownBatch(userId, id);
    if (batch.status === 'CONFIRMED') throw new BadRequestException('Importação já confirmada');
    if (!(await this.prisma.account.findFirst({ where: { id: dto.accountId, userId } }))) throw new NotFoundException('Conta não encontrada');

    const table = batch.rawRows as unknown as RawTable;
    const normalized = normalizeRows(table, dto.mapping as ImportMapping);
    const rules = await this.prisma.categoryRule.findMany({ where: { userId }, orderBy: { priority: 'desc' } });
    const categories = await this.prisma.category.findMany({ where: { userId } });

    // duplicidade: contagem de hashes já existentes na conta
    const hashes = normalized.map((r) => (r.date && r.amount != null ? txHash(dto.accountId, r.date, r.amount, r.description) : null));
    const existing = await this.prisma.transaction.groupBy({
      by: ['hash'], where: { userId, accountId: dto.accountId, hash: { in: hashes.filter(Boolean) as string[] } }, _count: true,
    });
    const existingCount = new Map(existing.map((e) => [e.hash, e._count]));
    const extIds = normalized.map((r) => r.externalId).filter(Boolean) as string[];
    const existingExt = new Set(
      (await this.prisma.transaction.findMany({
        where: { userId, accountId: dto.accountId, externalId: { in: extIds } }, select: { externalId: true },
      })).map((t) => t.externalId),
    );
    const seen = new Map<string, number>();

    const data: Prisma.ImportRowCreateManyInput[] = normalized.map((r, index) => {
      const hash = hashes[index];
      let status: 'PENDING' | 'DUPLICATE' | 'ERROR' = 'PENDING';
      if (r.error) status = 'ERROR';
      else if (hash) {
        const n = (seen.get(hash) ?? 0) + 1;
        seen.set(hash, n);
        if (n <= (existingCount.get(hash) ?? 0) || (r.externalId && existingExt.has(r.externalId))) status = 'DUPLICATE';
      }
      return {
        batchId: id, index, date: r.date ? new Date(r.date) : null, description: r.description, amount: r.amount,
        type: r.type, hash, externalId: r.externalId ?? null, status, error: r.error ?? null,
        skip: status === 'DUPLICATE',
        categoryId: r.type ? this.categorize(r.description, r.type, rules, categories) : null,
      };
    });

    await this.prisma.$transaction([
      this.prisma.importRow.deleteMany({ where: { batchId: id } }),
      this.prisma.importRow.createMany({ data }),
      this.prisma.importBatch.update({ where: { id }, data: { status: 'MAPPED', accountId: dto.accountId, mapping: dto.mapping as Prisma.InputJsonValue } }),
    ]);
    return this.detail(userId, id);
  }

  private categorize(
    description: string, type: 'INCOME' | 'EXPENSE',
    rules: { pattern: string; matchType: string; categoryId: string }[],
    categories: { id: string; kind: string }[],
  ): string | null {
    const norm = normalizeDescription(description);
    for (const r of rules) {
      const cat = categories.find((c) => c.id === r.categoryId);
      if (!cat || cat.kind !== type) continue;
      if (r.matchType === 'REGEX') {
        try { if (new RegExp(r.pattern, 'i').test(description)) return r.categoryId; } catch { /* regra inválida */ }
      } else if (norm.includes(normalizeDescription(r.pattern))) return r.categoryId;
    }
    return null;
  }

  async detail(userId: string, id: string) {
    const batch = await this.ownBatch(userId, id);
    const rows = await this.prisma.importRow.findMany({ where: { batchId: id }, orderBy: { index: 'asc' }, take: 2000 });
    const count = (s: string) => rows.filter((r) => r.status === s).length;
    const { rawRows: _raw, ...rest } = batch;
    return {
      ...rest,
      rows: rows.map((r) => ({ ...r, amount: r.amount == null ? null : Number(r.amount) })),
      counts: { pending: count('PENDING'), duplicate: count('DUPLICATE'), error: count('ERROR'), imported: count('IMPORTED') },
    };
  }

  async list(userId: string) {
    const batches = await this.prisma.importBatch.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, fileName: true, format: true, status: true, totalRows: true, createdAt: true },
    });
    return batches;
  }

  async patchRow(userId: string, id: string, rowId: string, dto: z.infer<typeof rowPatchSchema>) {
    await this.ownBatch(userId, id);
    const r = await this.prisma.importRow.updateMany({ where: { id: rowId, batchId: id }, data: dto });
    if (!r.count) throw new NotFoundException();
    return { ok: true };
  }

  async confirm(userId: string, id: string) {
    const batch = await this.ownBatch(userId, id);
    if (batch.status !== 'MAPPED' || !batch.accountId) throw new BadRequestException('Importação não está pronta para confirmar');
    const rows = await this.prisma.importRow.findMany({ where: { batchId: id, status: 'PENDING', skip: false } });
    await this.prisma.$transaction([
      this.prisma.transaction.createMany({
        data: rows.map((r) => ({
          userId, accountId: batch.accountId!, categoryId: r.categoryId, type: r.type!, amount: r.amount!, date: r.date!,
          description: r.description!, hash: r.hash!, externalId: r.externalId, importBatchId: id,
        })),
      }),
      this.prisma.importRow.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: 'IMPORTED' } }),
      this.prisma.importBatch.update({ where: { id }, data: { status: 'CONFIRMED' } }),
    ]);
    return { imported: rows.length };
  }

  async revert(userId: string, id: string) {
    await this.ownBatch(userId, id);
    const r = await this.prisma.$transaction([
      this.prisma.transaction.deleteMany({ where: { userId, importBatchId: id } }),
      this.prisma.importBatch.update({ where: { id }, data: { status: 'REVERTED' } }),
    ]);
    return { removed: r[0].count };
  }

  private async ownBatch(userId: string, id: string) {
    const b = await this.prisma.importBatch.findFirst({ where: { id, userId } });
    if (!b) throw new NotFoundException();
    return b;
  }
}

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
export class ImportsController {
  constructor(private svc: ImportsService) {}

  @Get() list(@CurrentUser() u: string) { return this.svc.list(u); }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(@CurrentUser() u: string, @UploadedFile() file: Express.Multer.File) { return this.svc.upload(u, file); }

  @Get(':id') detail(@CurrentUser() u: string, @Param('id') id: string) { return this.svc.detail(u, id); }

  @Post(':id/mapping')
  mapping(@CurrentUser() u: string, @Param('id') id: string, @Body(new ZodPipe(mappingSchema)) dto: MappingInput) {
    return this.svc.applyMapping(u, id, dto);
  }

  @Patch(':id/rows/:rowId')
  patchRow(@CurrentUser() u: string, @Param('id') id: string, @Param('rowId') rowId: string, @Body(new ZodPipe(rowPatchSchema)) dto: z.infer<typeof rowPatchSchema>) {
    return this.svc.patchRow(u, id, rowId, dto);
  }

  @Post(':id/confirm') confirm(@CurrentUser() u: string, @Param('id') id: string) { return this.svc.confirm(u, id); }

  @Delete(':id') revert(@CurrentUser() u: string, @Param('id') id: string) { return this.svc.revert(u, id); }
}

@Module({ controllers: [ImportsController], providers: [ImportsService] })
export class ImportsModule {}
