import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AiInsightsService } from '../ai-insights/ai-insights.service';
import { ImportExtractDto } from '../transactions/dto/import-extract.dto';

type JobType = 'import_pdf' | 'ocr_attachment' | 'weekly_summary';

@Injectable()
export class AsyncJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsyncJobsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
    private readonly aiInsightsService: AiInsightsService,
  ) {}

  onModuleInit() {
    if (process.env.DISABLE_JOB_POLLER === 'true') {
      this.logger.log('Poller de jobs assíncronos desativado na API (use processo worker dedicado).');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 1500);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(userId: string, type: JobType, payload: Record<string, unknown>) {
    const created = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO async_jobs
      ("id","userId","type","status","progress","payloadJson","createdAt")
      VALUES ($1,$2,$3,'queued',0,$4::jsonb,NOW())
      RETURNING id`,
      randomUUID(),
      userId,
      type,
      JSON.stringify(payload),
    );
    return { jobId: created[0].id };
  }

  async getJob(userId: string, id: string) {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        type: string;
        status: string;
        progress: number;
        resultJson: unknown;
        error: string | null;
        createdAt: Date;
        startedAt: Date | null;
        finishedAt: Date | null;
      }>
    >(
      `SELECT id,type,status,progress,"resultJson",error,"createdAt","startedAt","finishedAt"
       FROM async_jobs
       WHERE id = $1 AND "userId" = $2`,
      id,
      userId,
    );
    return rows[0] || null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ id: string; userId: string; type: string; payloadJson: unknown; attempts: number }>
      >(
        `SELECT id,"userId",type,"payloadJson",attempts
         FROM async_jobs
         WHERE status = 'queued'
         ORDER BY "createdAt" ASC
         LIMIT 1`,
      );
      if (!rows.length) return;
      const job = rows[0];
      const jobStartMs = Date.now();
      await this.prisma.$executeRawUnsafe(
        `UPDATE async_jobs SET status='processing',progress=10,"startedAt"=NOW(),attempts=attempts+1 WHERE id=$1`,
        job.id,
      );
      try {
        const result = await this.process(job.userId, job.type as JobType, (job.payloadJson || {}) as Record<string, unknown>, job.id);
        const durationMs = Date.now() - jobStartMs;
        await this.prisma.$executeRawUnsafe(
          `UPDATE async_jobs
           SET status='done',progress=100,"resultJson"=$2::jsonb,error=NULL,"finishedAt"=NOW(),"durationMs"=$3
           WHERE id=$1`,
          job.id,
          JSON.stringify(result ?? {}),
          durationMs,
        );
        if (job.type === 'import_pdf') {
          const meta = (typeof result === 'object' && result) || {};
          try {
            await this.prisma.$executeRawUnsafe(
              `INSERT INTO import_metrics ("id","userId","source","success","durationMs","meta","createdAt")
               VALUES ($1,$2,$3,true,$4,$5::jsonb,NOW())`,
              randomUUID(),
              job.userId,
              'pdf_async',
              durationMs,
              JSON.stringify({ jobId: job.id, ...meta as object }),
            );
          } catch {
            /* import_metrics pode não existir até migrate */
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : 'Erro no job';
        const durationMs = Date.now() - jobStartMs;
        await this.prisma.$executeRawUnsafe(
          `UPDATE async_jobs SET status='failed',error=$2,"finishedAt"=NOW(),"durationMs"=$3 WHERE id=$1`,
          job.id,
          message,
          durationMs,
        );
        if (job.type === 'import_pdf') {
          try {
            await this.prisma.$executeRawUnsafe(
              `INSERT INTO import_metrics ("id","userId","source","success","durationMs","meta","createdAt")
               VALUES ($1,$2,$3,false,$4,$5::jsonb,NOW())`,
              randomUUID(),
              job.userId,
              'pdf_async',
              durationMs,
              JSON.stringify({ jobId: job.id, error: message }),
            );
          } catch {
            /* import_metrics pode não existir até migrate */
          }
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async process(
    userId: string,
    type: JobType,
    payload: Record<string, unknown>,
    jobId: string,
  ) {
    if (type === 'import_pdf') {
      await this.prisma.$executeRawUnsafe(`UPDATE async_jobs SET progress=35 WHERE id=$1`, jobId);
      const base64 = String(payload.fileBase64 || '');
      const dto = (payload.importDto || {}) as ImportExtractDto;
      const out = await this.transactionsService.importAiExtract(
        userId,
        Buffer.from(base64, 'base64'),
        String(payload.mimeType || 'application/pdf'),
        String(payload.originalName || ''),
        dto,
      );
      return out;
    }
    if (type === 'ocr_attachment') {
      await this.prisma.$executeRawUnsafe(`UPDATE async_jobs SET progress=50 WHERE id=$1`, jobId);
      const attachmentId = String(payload.attachmentId || '');
      return this.aiInsightsService.ocrAttachment(userId, attachmentId);
    }
    if (type === 'weekly_summary') {
      await this.prisma.$executeRawUnsafe(`UPDATE async_jobs SET progress=60 WHERE id=$1`, jobId);
      const weekStart = payload.weekStart ? String(payload.weekStart) : undefined;
      return this.aiInsightsService.getWeeklyFinancialSummary(userId, weekStart);
    }
    throw new Error(`Tipo de job não suportado: ${type}`);
  }
}
