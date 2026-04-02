import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  /** Para readiness probes: true se a BD responde. */
  async isDatabaseReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async check() {
    const startTime = Date.now();
    
    try {
      // Verificar conexão com banco de dados
      await this.prisma.$queryRaw`SELECT 1`;
      
      const responseTime = Date.now() - startTime;
      const memoryUsage = process.memoryUsage();
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: {
          status: 'connected',
          responseTime: `${responseTime}ms`,
        },
        memory: {
          used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: {
          status: 'disconnected',
          error: error.message,
        },
      };
    }
  }

  async metrics(lastMinutes = 15) {
    const since = new Date(Date.now() - Math.max(1, lastMinutes) * 60 * 1000);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ method: string; route: string; statusCode: number; latencyMs: number }>
    >(
      `SELECT "method","route","statusCode","latencyMs"
       FROM endpoint_metrics
       WHERE "createdAt" >= $1
       ORDER BY "createdAt" DESC
       LIMIT 1000`,
      since,
    );
    const grouped = new Map<string, { count: number; errors: number; totalLatency: number }>();
    for (const r of rows) {
      const key = `${r.method} ${r.route}`;
      if (!grouped.has(key)) grouped.set(key, { count: 0, errors: 0, totalLatency: 0 });
      const g = grouped.get(key)!;
      g.count += 1;
      if (r.statusCode >= 500) g.errors += 1;
      g.totalLatency += r.latencyMs;
    }
    const endpoints = Array.from(grouped.entries()).map(([key, v]) => ({
      endpoint: key,
      requests: v.count,
      errorRate: v.count ? Number(((v.errors / v.count) * 100).toFixed(2)) : 0,
      avgLatencyMs: v.count ? Math.round(v.totalLatency / v.count) : 0,
    }));
    endpoints.sort((a, b) => b.requests - a.requests);
    return { windowMinutes: lastMinutes, endpoints };
  }

  async errors(lastMinutes = 60) {
    const since = new Date(Date.now() - Math.max(1, lastMinutes) * 60 * 1000);
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ route: string; method: string; statusCode: number; total: number }>
    >(
      `SELECT route, method, "statusCode", COUNT(*)::int as total
       FROM endpoint_metrics
       WHERE "createdAt" >= $1 AND "statusCode" >= 500
       GROUP BY route, method, "statusCode"
       ORDER BY total DESC`,
      since,
    );
    return { windowMinutes: lastMinutes, errors: rows };
  }

  async importBusinessMetrics(lastHours = 24) {
    const since = new Date(Date.now() - Math.max(1, lastHours) * 3600000);
    const imports = await this.prisma.$queryRawUnsafe<
      Array<{ source: string; total: number; successes: number; avg_ms: number }>
    >(
      `SELECT source,
              COUNT(*)::int as total,
              SUM(CASE WHEN success THEN 1 ELSE 0 END)::int as successes,
              COALESCE(AVG("durationMs")::int, 0)::int as avg_ms
       FROM import_metrics
       WHERE "createdAt" >= $1
       GROUP BY source
       ORDER BY total DESC`,
      since,
    );
    const jobs = await this.prisma.$queryRawUnsafe<
      Array<{ type: string; total: number; failed: number; avg_ms: number }>
    >(
      `SELECT type,
              COUNT(*)::int as total,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::int as failed,
              COALESCE(AVG("durationMs") FILTER (WHERE "durationMs" IS NOT NULL), 0)::int as avg_ms
       FROM async_jobs
       WHERE "createdAt" >= $1
       GROUP BY type
       ORDER BY total DESC`,
      since,
    );
    return { windowHours: lastHours, imports, asyncJobs: jobs };
  }

  /** Filas async_jobs para monitorização (worker / alertas). */
  async asyncJobsQueueStats() {
    try {
      const grouped = await this.prisma.asyncJob.groupBy({
        by: ['status'],
        _count: { id: true },
      });
      const countsByStatus = Object.fromEntries(
        grouped.map((g) => [g.status, g._count.id]),
      );
      const oldestQueued = await this.prisma.asyncJob.findFirst({
        where: { status: 'queued' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true, type: true },
      });
      const failedLastHour = await this.prisma.asyncJob.count({
        where: {
          status: 'failed',
          finishedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });
      const processingStale = await this.prisma.asyncJob.count({
        where: {
          status: 'processing',
          startedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
        },
      });
      return {
        timestamp: new Date().toISOString(),
        jobPollerDisabled: process.env.DISABLE_JOB_POLLER === 'true',
        countsByStatus,
        oldestQueued: oldestQueued
          ? {
              id: oldestQueued.id,
              type: oldestQueued.type,
              createdAt: oldestQueued.createdAt.toISOString(),
            }
          : null,
        failedLastHour,
        processingOlderThan30Min: processingStale,
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'unknown',
      };
    }
  }
}
