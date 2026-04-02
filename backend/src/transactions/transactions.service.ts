import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { randomUUID, createHash } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { TransactionType } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
function detectMimeFromMagic(buffer: Buffer): string | null {
  if (buffer.length >= 4) {
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return 'image/gif';
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) return 'image/webp';
  }
  return null;
}
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { ImportExtractDto } from './dto/import-extract.dto';
import { BatchTransactionsDto } from './dto/batch-transactions.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { AiInsightsService } from '../ai-insights/ai-insights.service';
import { AuditService } from '../common/services/audit.service';
import { AttachmentScannerService } from './attachment-scanner.service';
import { ATTACHMENT_MAX_FILE_BYTES } from '../common/constants/upload-limits';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private aiInsights: AiInsightsService,
    private auditService: AuditService,
    private attachmentScanner: AttachmentScannerService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async invalidateDashboardCache() {
    const manager = this.cacheManager as Cache & { reset?: () => Promise<void> };
    if (typeof manager.reset === 'function') {
      await manager.reset();
    }
  }

  private async recordImportMetric(params: {
    userId: string;
    source: string;
    success: boolean;
    durationMs: number;
    meta?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO import_metrics ("id","userId","source","success","durationMs","meta","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,NOW())`,
        randomUUID(),
        params.userId,
        params.source,
        params.success,
        params.durationMs,
        JSON.stringify(params.meta ?? {}),
      );
    } catch {
      /* tabela pode ainda não existir até migrate deploy */
    }
  }

  async create(userId: string, createTransactionDto: CreateTransactionDto) {
    const { categoryId, amount, type, deductiblePotential: dtoDeductible, bankMemo, userNote } =
      createTransactionDto;

    // Verificar se a categoria existe e pertence ao usuário
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    if (category.userId !== userId) {
      throw new ForbiddenException('Categoria não pertence ao usuário');
    }

    // Verificar se o tipo da transação corresponde ao tipo da categoria
    if (category.type !== type) {
      throw new BadRequestException(
        'Tipo da transação não corresponde ao tipo da categoria',
      );
    }

    // Regra de negócio: Valor deve ser positivo
    if (amount <= 0) {
      throw new BadRequestException('Valor deve ser maior que zero');
    }

    const deductiblePotential =
      typeof dtoDeductible === 'boolean'
        ? dtoDeductible
        : type === 'EXPENSE' && !!category.suggestTaxDeductible;

    // Criar transação
    const created = await this.prisma.transaction.create({
      data: {
        type,
        amount: new Decimal(amount),
        description: createTransactionDto.description,
        date: new Date(createTransactionDto.date),
        categoryId,
        userId,
        deductiblePotential,
        bankMemo: bankMemo ?? undefined,
        ...(typeof userNote === 'string' && userNote.trim()
          ? { userNote: userNote.trim().slice(0, 2000) }
          : {}),
      },
      include: {
        category: true,
      },
    });
    await this.auditService.log({
      userId,
      actorUserId: userId,
      entity: 'transaction',
      entityId: created.id,
      action: 'create',
      afterJson: {
        amount: Number(created.amount),
        categoryId: created.categoryId,
        deductiblePotential: created.deductiblePotential,
      },
    });
    await this.invalidateDashboardCache();
    return created;
  }

  async findAll(userId: string, query: TransactionQueryDto) {
    const where: any = { userId };

    if (query.type) {
      where.type = query.type;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.date.lte = new Date(query.endDate);
      }
    }

    // Paginação
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          category: true,
          _count: { select: { attachments: true } },
        },
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        category: true,
        _count: { select: { attachments: true } },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    if (transaction.userId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }

    return transaction;
  }

  async update(
    userId: string,
    id: string,
    updateTransactionDto: UpdateTransactionDto,
  ) {
    const transaction = await this.findOne(userId, id);

    // Se estiver atualizando categoria, verificar se existe e pertence ao usuário
    if (updateTransactionDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateTransactionDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Categoria não encontrada');
      }

      if (category.userId !== userId) {
        throw new ForbiddenException('Categoria não pertence ao usuário');
      }
    }

    // Se estiver atualizando valor, verificar se é positivo
    if (updateTransactionDto.amount !== undefined) {
      if (updateTransactionDto.amount <= 0) {
        throw new BadRequestException('Valor deve ser maior que zero');
      }
    }

    const updateData: Record<string, unknown> = { ...updateTransactionDto };

    if (updateData.amount !== undefined) {
      updateData.amount = new Decimal(updateData.amount as number);
    }

    if (updateData.date) {
      updateData.date = new Date(updateData.date as string);
    }

    const before = {
      amount: Number(transaction.amount),
      categoryId: transaction.categoryId,
      deductiblePotential: transaction.deductiblePotential,
    };
    const updated = await this.prisma.transaction.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });
    await this.auditService.log({
      userId,
      actorUserId: userId,
      entity: 'transaction',
      entityId: id,
      action: 'update',
      beforeJson: before,
      afterJson: {
        amount: Number(updated.amount),
        categoryId: updated.categoryId,
        deductiblePotential: updated.deductiblePotential,
      },
    });
    await this.invalidateDashboardCache();
    return updated;
  }

  async remove(userId: string, id: string) {
    const existing = await this.findOne(userId, id);
    const removed = await this.prisma.transaction.delete({
      where: { id },
    });
    await this.auditService.log({
      userId,
      actorUserId: userId,
      entity: 'transaction',
      entityId: id,
      action: 'delete',
      beforeJson: {
        amount: Number(existing.amount),
        categoryId: existing.categoryId,
        deductiblePotential: existing.deductiblePotential,
      },
    });
    await this.invalidateDashboardCache();
    return removed;
  }

  async getBalance(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
    });

    let balance = new Decimal(0);

    transactions.forEach((transaction) => {
      if (transaction.type === 'INCOME') {
        balance = balance.add(transaction.amount);
      } else {
        balance = balance.sub(transaction.amount);
      }
    });

    return {
      balance: balance.toNumber(),
    };
  }

  private uploadsRoot(): string {
    return join(process.cwd(), 'uploads');
  }

  private async ensureImportCategory(
    userId: string,
    type: TransactionType,
    name: string,
  ) {
    const existing = await this.prisma.category.findFirst({
      where: { userId, type, name },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.category.create({
      data: {
        userId,
        type,
        name,
        color: type === 'EXPENSE' ? '#64748b' : '#22c55e',
      },
    });
  }

  private async resolveCategoryForImport(
    userId: string,
    type: TransactionType,
    categoryId: string | undefined,
    fallbackName: string,
  ) {
    if (categoryId) {
      const c = await this.prisma.category.findFirst({
        where: { id: categoryId, userId },
      });
      if (!c) {
        throw new BadRequestException('Categoria da importação não encontrada');
      }
      if (c.type !== type) {
        throw new BadRequestException(
          'A categoria escolhida não corresponde ao tipo do movimento (receita/despesa)',
        );
      }
      return c;
    }
    return this.ensureImportCategory(userId, type, fallbackName);
  }

  private resolveImportMime(buffer: Buffer, mimetype: string, originalName: string): string {
    const name = (originalName || '').toLowerCase();
    let mime = (mimetype || '').toLowerCase();
    if (!mime || mime === 'application/octet-stream') {
      const magic = detectMimeFromMagic(buffer);
      if (magic === 'application/pdf') {
        return 'application/pdf';
      }
      if (magic?.startsWith('image/')) {
        return magic;
      }
    }
    if (name.endsWith('.csv')) {
      return 'text/csv';
    }
    if (
      mime === 'text/csv' ||
      mime === 'application/csv' ||
      (mime === 'text/plain' && name.endsWith('.csv')) ||
      (mime === 'application/vnd.ms-excel' && name.endsWith('.csv'))
    ) {
      return 'text/csv';
    }
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      return 'application/pdf';
    }
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
      return mime;
    }
    if (/\.(jpe?g|png|webp|gif)$/.test(name)) {
      if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
        return 'image/jpeg';
      }
      if (name.endsWith('.png')) {
        return 'image/png';
      }
      if (name.endsWith('.webp')) {
        return 'image/webp';
      }
      if (name.endsWith('.gif')) {
        return 'image/gif';
      }
    }
    throw new BadRequestException(
      'Formato não suportado. Envie CSV, PDF ou imagem (JPEG, PNG, WebP, GIF).',
    );
  }

  private normCategoryLabel(s: string) {
    return s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .trim();
  }

  private async resolveCategoryFromAiSuggestion(
    userId: string,
    type: TransactionType,
    suggestedName: string | undefined,
    defaultCategoryId: string | undefined,
    fallbackName: string,
  ) {
    const sn = suggestedName?.trim() ? this.normCategoryLabel(suggestedName) : '';
    if (sn.length > 0) {
      const cats = await this.prisma.category.findMany({
        where: { userId, type },
        select: { id: true, name: true, type: true, suggestTaxDeductible: true },
      });
      const exact = cats.find((c) => this.normCategoryLabel(c.name) === sn);
      if (exact) {
        return exact;
      }
      const partial = cats.find(
        (c) =>
          this.normCategoryLabel(c.name).includes(sn) ||
          (sn.length >= 4 && sn.includes(this.normCategoryLabel(c.name))),
      );
      if (partial && this.normCategoryLabel(partial.name).length >= 2) {
        return partial;
      }
    }
    return this.resolveCategoryForImport(userId, type, defaultCategoryId, fallbackName);
  }

  private deductibleFromAiRow(
    type: TransactionType,
    category: { suggestTaxDeductible: boolean | null },
    ai?: boolean,
  ): boolean {
    if (type !== 'EXPENSE') {
      return false;
    }
    if (ai === true) {
      return true;
    }
    if (ai === false) {
      return false;
    }
    return !!category.suggestTaxDeductible;
  }

  /** Importação direta: CSV, PDF ou imagem — Gemini extrai movimentos */
  async importAiExtract(
    userId: string,
    buffer: Buffer,
    mimetype: string,
    originalName: string,
    dto: ImportExtractDto,
  ) {
    const started = Date.now();
    const effectiveMime = this.resolveImportMime(buffer, mimetype, originalName);
    try {
      const rows = await this.aiInsights.extractBankTransactionsFromMedia(
        buffer,
        effectiveMime,
        originalName,
      );
      if (rows.length === 0) {
        throw new BadRequestException(
          'Nenhum movimento reconhecido. Envie extrato legível (CSV, PDF ou imagem nítida).',
        );
      }

      let imported = 0;
      let skipped = 0;
      let invalid = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const d = new Date(row.date);
        if (Number.isNaN(d.getTime()) || row.amount <= 0) {
          invalid++;
          continue;
        }
        const type = row.type;
        const category = await this.resolveCategoryFromAiSuggestion(
          userId,
          type,
          row.suggestedCategory,
          type === 'EXPENSE' ? dto.defaultExpenseCategoryId : dto.defaultIncomeCategoryId,
          type === 'EXPENSE' ? 'Importação IA — despesas' : 'Importação IA — receitas',
        );
        const abs = new Decimal(row.amount);
        const sig = createHash('sha256')
          .update(`${i}\n${row.date}\n${row.amount}\n${type}\n${row.description}`)
          .digest('hex')
          .slice(0, 40);
        const bankMemo = `ai:${sig}`;

        const dup = await this.prisma.transaction.findFirst({
          where: { userId, bankMemo },
        });
        if (dup) {
          skipped++;
          continue;
        }

        const deductiblePotential = this.deductibleFromAiRow(
          type,
          category,
          row.suggestedDeductibleIrrf,
        );

        await this.prisma.transaction.create({
          data: {
            userId,
            categoryId: category.id,
            type,
            amount: abs,
            date: d,
            description: row.description.slice(0, 255),
            bankMemo,
            deductiblePotential,
          },
        });
        imported++;
      }

      await this.invalidateDashboardCache();
      const out = {
        imported,
        skipped,
        invalid,
        totalParsed: rows.length,
      };
      await this.recordImportMetric({
        userId,
        source: 'ai_extract_sync',
        success: true,
        durationMs: Date.now() - started,
        meta: out,
      });
      return out;
    } catch (err) {
      await this.recordImportMetric({
        userId,
        source: 'ai_extract_sync',
        success: false,
        durationMs: Date.now() - started,
        meta: { error: err instanceof Error ? err.message : 'erro' },
      });
      throw err;
    }
  }

  async previewAiExtract(
    userId: string,
    buffer: Buffer,
    mimetype: string,
    originalName: string,
    dto: ImportExtractDto,
  ) {
    const effectiveMime = this.resolveImportMime(buffer, mimetype, originalName);
    const rows = await this.aiInsights.extractBankTransactionsFromMedia(
      buffer,
      effectiveMime,
      originalName,
    );
    if (rows.length === 0) {
      throw new BadRequestException(
        'Nenhum movimento reconhecido. Envie extrato legível (CSV, PDF ou imagem nítida).',
      );
    }
    const preview: Array<Record<string, unknown>> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const d = new Date(row.date);
      if (Number.isNaN(d.getTime()) || row.amount <= 0) {
        preview.push({
          tempId: `ai-${i}`,
          date: row.date,
          amount: row.amount,
          type: row.type,
          description: row.description,
          aiSuggestedCategory: row.suggestedCategory,
          invalid: true,
        });
        continue;
      }
      const type = row.type;
      const category = await this.resolveCategoryFromAiSuggestion(
        userId,
        type,
        row.suggestedCategory,
        type === 'EXPENSE' ? dto.defaultExpenseCategoryId : dto.defaultIncomeCategoryId,
        type === 'EXPENSE' ? 'Importação IA — despesas' : 'Importação IA — receitas',
      );
      const sig = createHash('sha256')
        .update(`${i}\n${row.date}\n${row.amount}\n${type}\n${row.description}`)
        .digest('hex')
        .slice(0, 40);
      const bankMemo = `ai:${sig}`;
      const dup = await this.prisma.transaction.findFirst({
        where: { userId, bankMemo },
      });
      const deductiblePotential = this.deductibleFromAiRow(
        type,
        category,
        row.suggestedDeductibleIrrf,
      );
      preview.push({
        tempId: `ai-${i}`,
        date: d.toISOString().slice(0, 10),
        amount: row.amount,
        type,
        description: row.description.slice(0, 255),
        bankMemo,
        categoryId: category.id,
        categoryName: category.name,
        aiSuggestedCategory: row.suggestedCategory,
        duplicateInDb: !!dup,
        deductiblePotential,
      });
    }
    return { source: 'ai_extract' as const, rows: preview };
  }

  async confirmImport(userId: string, dto: ConfirmImportDto) {
    const started = Date.now();
    try {
      let imported = 0;
      for (const r of dto.rows) {
        if (r.type !== 'INCOME' && r.type !== 'EXPENSE') continue;
        const category = await this.prisma.category.findFirst({
          where: { id: r.categoryId, userId },
        });
        if (!category) throw new BadRequestException(`Categoria inválida: ${r.categoryId}`);
        if (category.type !== r.type) {
          throw new BadRequestException(
            'Categoria não corresponde ao tipo receita/despesa de uma linha',
          );
        }
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime()) || r.amount <= 0) continue;
        const bankMemo =
          r.bankMemo ||
          `manual:${createHash('sha256')
            .update(`${r.date}\n${r.amount}\n${r.type}\n${r.description}`)
            .digest('hex')
            .slice(0, 40)}`;
        const dup = await this.prisma.transaction.findFirst({
          where: { userId, bankMemo },
        });
        if (dup) continue;
        let deductiblePotential = false;
        if (r.type === 'EXPENSE') {
          if (typeof r.deductiblePotential === 'boolean') {
            deductiblePotential = r.deductiblePotential;
          } else {
            deductiblePotential = !!category.suggestTaxDeductible;
          }
        }
        await this.prisma.transaction.create({
          data: {
            userId,
            categoryId: r.categoryId,
            type: r.type,
            amount: new Decimal(r.amount),
            date: d,
            description: r.description.slice(0, 255),
            bankMemo,
            deductiblePotential,
          },
        });
        imported++;
      }
      await this.invalidateDashboardCache();
      const out = { imported, totalRequested: dto.rows.length };
      await this.recordImportMetric({
        userId,
        source: 'confirm_import',
        success: true,
        durationMs: Date.now() - started,
        meta: out,
      });
      return out;
    } catch (err) {
      await this.recordImportMetric({
        userId,
        source: 'confirm_import',
        success: false,
        durationMs: Date.now() - started,
        meta: { error: err instanceof Error ? err.message : 'erro' },
      });
      throw err;
    }
  }

  async findDuplicateCandidates(userId: string, daysBack = 120) {
    const since = new Date(Date.now() - daysBack * 86400000);
    const txs = await this.prisma.transaction.findMany({
      where: { userId, date: { gte: since } },
      select: {
        id: true,
        date: true,
        amount: true,
        description: true,
        bankMemo: true,
        type: true,
      },
      orderBy: { date: 'desc' },
      take: 2000,
    });
    const norm = (s: string | null | undefined) =>
      (s || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 48);
    const groups = new Map<
      string,
      Array<{ id: string; date: Date; amount: string; description: string | null; bankMemo: string | null }>
    >();
    for (const t of txs) {
      const day = t.date.toISOString().slice(0, 10);
      const amt = t.amount.toString();
      const memoKey = (t.bankMemo || '').trim();
      const key =
        memoKey.length > 0
          ? `m|${day}|${amt}|${memoKey}`
          : `d|${day}|${amt}|${norm(t.description)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({
        id: t.id,
        date: t.date,
        amount: amt,
        description: t.description,
        bankMemo: t.bankMemo,
      });
    }
    const clusters = Array.from(groups.values()).filter((g) => g.length >= 2);
    return {
      count: clusters.length,
      clusters: clusters.map((g) => ({
        transactions: g.map((x) => ({
          id: x.id,
          date: x.date.toISOString().slice(0, 10),
          amount: Number(x.amount),
          description: x.description,
          bankMemo: x.bankMemo,
        })),
      })),
    };
  }

  async mergeDuplicateTransactions(
    userId: string,
    keepTransactionId: string,
    removeTransactionId: string,
  ) {
    if (keepTransactionId === removeTransactionId) {
      throw new BadRequestException('IDs iguais');
    }
    const [keep, remove] = await Promise.all([
      this.findOne(userId, keepTransactionId),
      this.findOne(userId, removeTransactionId),
    ]);
    const ka = Number(keep.amount);
    const ra = Number(remove.amount);
    const kd = keep.date.toISOString().slice(0, 10);
    const rd = remove.date.toISOString().slice(0, 10);
    const normDesc = (s: string | null | undefined) =>
      (s || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 48);
    const sameAmount = Math.abs(ka - ra) < 0.005;
    const sameDay = kd === rd;
    const memoMatch =
      (keep.bankMemo || '') === (remove.bankMemo || '') &&
      (keep.bankMemo || '').length > 0;
    const descMatch =
      normDesc(keep.description) === normDesc(remove.description) &&
      normDesc(keep.description).length > 0;
    if (!(sameAmount && sameDay && (memoMatch || descMatch))) {
      throw new BadRequestException(
        'Lançamentos não parecem duplicados (data, valor e memorando/descrição)',
      );
    }
    await this.prisma.transactionAttachment.updateMany({
      where: { transactionId: removeTransactionId },
      data: { transactionId: keepTransactionId },
    });
    await this.prisma.transaction.delete({ where: { id: removeTransactionId } });
    await this.auditService.log({
      userId,
      actorUserId: userId,
      entity: 'transaction',
      entityId: keepTransactionId,
      action: 'merge-duplicate',
      afterJson: { removedId: removeTransactionId },
    });
    await this.invalidateDashboardCache();
    return { keptId: keepTransactionId, removedId: removeTransactionId };
  }

  async batchUpdateTransactions(userId: string, dto: BatchTransactionsDto) {
    const {
      transactionIds,
      categoryId,
      deductiblePotential,
      userNote,
    } = dto;
    if (
      categoryId === undefined &&
      deductiblePotential === undefined &&
      userNote === undefined
    ) {
      throw new BadRequestException('Nada para atualizar');
    }
    const txs = await this.prisma.transaction.findMany({
      where: { userId, id: { in: transactionIds } },
    });
    if (txs.length !== transactionIds.length) {
      throw new BadRequestException('Uma ou mais transações não foram encontradas');
    }
    if (categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: categoryId, userId },
      });
      if (!cat) throw new NotFoundException('Categoria não encontrada');
      for (const t of txs) {
        if (cat.type !== t.type) {
          throw new BadRequestException(
            `Categoria incompatível com o tipo da transação ${t.id}`,
          );
        }
      }
    }
    const data: Record<string, unknown> = {};
    if (categoryId) data.categoryId = categoryId;
    if (deductiblePotential !== undefined) data.deductiblePotential = deductiblePotential;
    if (userNote !== undefined) data.userNote = userNote.slice(0, 2000);
    await this.prisma.transaction.updateMany({
      where: { userId, id: { in: transactionIds } },
      data: data as any,
    });
    await this.invalidateDashboardCache();
    return { updated: transactionIds.length };
  }

  async listAttachments(userId: string, transactionId: string) {
    await this.findOne(userId, transactionId);
    return this.prisma.transactionAttachment.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
    });
  }

  async addAttachment(
    userId: string,
    transactionId: string,
    file: Express.Multer.File,
  ) {
    await this.findOne(userId, transactionId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Ficheiro vazio');
    }
    if (file.size > ATTACHMENT_MAX_FILE_BYTES) {
      const maxMb = Math.round(ATTACHMENT_MAX_FILE_BYTES / (1024 * 1024));
      throw new BadRequestException(`Ficheiro demasiado grande (máx. ${maxMb} MB)`);
    }
    const mime = (detectMimeFromMagic(file.buffer) || file.mimetype || 'application/octet-stream').toLowerCase();
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(mime)) {
      throw new BadRequestException('Tipo de ficheiro não permitido (PDF/JPG/PNG/WEBP)');
    }
    await this.attachmentScanner.scanOrThrow(file);

    const userDir = join(this.uploadsRoot(), userId);
    await mkdir(userDir, { recursive: true });
    const id = randomUUID();
    const safe = (file.originalname || 'anexo')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    const diskName = `${id}-${safe}`;
    const storagePath = `${userId}/${diskName}`;
    const fullPath = join(this.uploadsRoot(), userId, diskName);
    await writeFile(fullPath, file.buffer);

    return this.prisma.transactionAttachment.create({
      data: {
        transactionId,
        fileName: file.originalname || 'anexo',
        mimeType: mime,
        storagePath,
        fileSize: file.size,
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
    });
  }

  async getAttachmentStream(
    userId: string,
    transactionId: string,
    attachmentId: string,
  ): Promise<{
    stream: ReturnType<typeof createReadStream>;
    fileName: string;
    mimeType: string;
  }> {
    const att = await this.prisma.transactionAttachment.findFirst({
      where: {
        id: attachmentId,
        transactionId,
        transaction: { userId },
      },
    });
    if (!att) {
      throw new NotFoundException('Anexo não encontrado');
    }
    const fullPath = join(this.uploadsRoot(), ...att.storagePath.split('/'));
    if (!existsSync(fullPath)) {
      throw new NotFoundException('Ficheiro em falta no servidor');
    }
    return {
      stream: createReadStream(fullPath),
      fileName: att.fileName,
      mimeType: att.mimeType,
    };
  }

  createAttachmentDownloadToken(
    userId: string,
    transactionId: string,
    attachmentId: string,
    expiresInSeconds = 300,
  ) {
    const secret = process.env.ATTACHMENT_URL_SECRET || process.env.JWT_SECRET || 'dev-secret';
    const exp = Math.floor(Date.now() / 1000) + Math.max(30, Math.min(expiresInSeconds, 3600));
    const payload = `${userId}.${transactionId}.${attachmentId}.${exp}`;
    const sig = createHash('sha256').update(`${payload}.${secret}`).digest('hex');
    const token = Buffer.from(`${payload}.${sig}`).toString('base64url');
    return { token, expiresAt: new Date(exp * 1000).toISOString() };
  }

  validateAttachmentDownloadToken(
    token: string,
    userId: string,
    transactionId: string,
    attachmentId: string,
  ) {
    const secret = process.env.ATTACHMENT_URL_SECRET || process.env.JWT_SECRET || 'dev-secret';
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [uid, tid, aid, expStr, sig] = decoded.split('.');
    if (!uid || !tid || !aid || !expStr || !sig) {
      throw new BadRequestException('Token de download inválido');
    }
    if (uid !== userId || tid !== transactionId || aid !== attachmentId) {
      throw new BadRequestException('Token não corresponde ao anexo');
    }
    const expected = createHash('sha256')
      .update(`${uid}.${tid}.${aid}.${expStr}.${secret}`)
      .digest('hex');
    if (expected !== sig) {
      throw new BadRequestException('Assinatura do token inválida');
    }
    if (Number(expStr) < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException('Token expirado');
    }
  }
}
