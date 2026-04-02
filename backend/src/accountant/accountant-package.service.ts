import { Injectable } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import type { Response } from 'express';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma/prisma.service';

function safeSegment(name: string, max = 80) {
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'sem-nome';
}

@Injectable()
export class AccountantPackageService {
  constructor(private readonly prisma: PrismaService) {}

  private uploadsRoot() {
    return join(process.cwd(), 'uploads');
  }

  async streamZipToResponse(
    userId: string,
    res: Response,
    year: number,
    month?: string,
  ) {
    const y = year || new Date().getFullYear();
    let start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
    let end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
    let suffix = `${y}`;
    if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      const [ys, ms] = month.split('-').map(Number);
      start = new Date(Date.UTC(ys, ms - 1, 1));
      end = new Date(Date.UTC(ys, ms, 0, 23, 59, 59, 999));
      suffix = month;
    }

    const txs = await this.prisma.transaction.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: {
        category: { select: { name: true } },
        attachments: true,
      },
      orderBy: { date: 'asc' },
    });

    const deductible = txs.filter((t) => t.type === 'EXPENSE' && t.deductiblePotential);
    const missingAttachDeductible = deductible.filter((a) => a.attachments.length === 0).length;

    const archive = archiver('zip', { zlib: { level: 6 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="financeflow-contador-${suffix}.zip"`,
    );
    archive.on('error', (err: Error) => {
      res.status(500).end(String(err.message));
    });
    archive.pipe(res);

    const checklist = [
      'FinanceFlow — pacote para contador (organização, sem validação legal)',
      `Período: ${suffix}`,
      `Total lançamentos: ${txs.length}`,
      `Despesas com marcação potencial IR: ${deductible.length}`,
      `Dessas sem anexo: ${missingAttachDeductible}`,
      '',
      'Revise valores, categorias e comprovantes antes de declarar.',
    ].join('\n');
    archive.append(checklist, { name: 'checklist.txt' });

    const csvLines = [
      'data,tipo,valor,descricao,categoria,memo_extrato,potencial_ir,nota',
      ...txs.map((t) =>
        [
          t.date.toISOString().slice(0, 10),
          t.type,
          t.amount.toString(),
          `"${(t.description || '').replace(/"/g, '""')}"`,
          `"${(t.category?.name || '').replace(/"/g, '""')}"`,
          `"${(t.bankMemo || '').replace(/"/g, '""')}"`,
          t.deductiblePotential ? 'sim' : 'nao',
          `"${((t as { userNote?: string | null }).userNote || '').replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ];
    archive.append(csvLines.join('\n'), { name: `movimentos-${suffix}.csv` });

    const dedLines = [
      'data,valor,descricao,categoria,qtd_anexos',
      ...deductible.map((t) =>
        [
          t.date.toISOString().slice(0, 10),
          t.amount.toString(),
          `"${(t.description || '').replace(/"/g, '""')}"`,
          `"${(t.category?.name || '').replace(/"/g, '""')}"`,
          String(t.attachments.length),
        ].join(','),
      ),
    ];
    archive.append(dedLines.join('\n'), {
      name: `despesas-potencial-ir-${suffix}.csv`,
    });

    const pdfBuf = await this.buildSummaryPdf(txs.length, deductible.length, suffix);
    archive.append(pdfBuf, { name: `resumo-${suffix}.pdf` });

    for (const t of txs) {
      if (!t.attachments.length) continue;
      const catFolder = safeSegment(t.category?.name || 'sem-categoria');
      for (const att of t.attachments) {
        const fullPath = join(this.uploadsRoot(), ...att.storagePath.split('/'));
        if (!existsSync(fullPath)) continue;
        const fname = safeSegment(`${t.date.toISOString().slice(0, 10)}_${att.fileName}`);
        const entryPath = `anexos/${catFolder}/${fname}`;
        archive.append(createReadStream(fullPath), { name: entryPath });
      }
    }

    await archive.finalize();
  }

  private buildSummaryPdf(totalTx: number, flagged: number, period: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.fontSize(16).text('FinanceFlow — Resumo para contador');
      doc.moveDown();
      doc.fontSize(11).text(`Período: ${period}`);
      doc.text(`Lançamentos: ${totalTx}`);
      doc.text(`Despesas marcadas potencial IR: ${flagged}`);
      doc.moveDown();
      doc
        .fontSize(9)
        .fillColor('#555')
        .text(
          'Documento gerado pela aplicação para organização. Não constitui orientação fiscal nem substitui profissional habilitado.',
        );
      doc.end();
    });
  }
}
