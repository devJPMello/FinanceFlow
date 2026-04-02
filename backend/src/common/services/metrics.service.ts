import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordEndpointMetric(input: {
    method: string;
    route: string;
    statusCode: number;
    latencyMs: number;
    requestId?: string;
  }) {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO endpoint_metrics ("id","method","route","statusCode","latencyMs","requestId","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        randomUUID(),
        input.method,
        input.route,
        input.statusCode,
        input.latencyMs,
        input.requestId ?? null,
      );
    } catch (error) {
      this.logger.warn(`Falha ao gravar métrica: ${error instanceof Error ? error.message : error}`);
    }
  }
}
