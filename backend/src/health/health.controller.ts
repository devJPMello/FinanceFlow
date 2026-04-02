import { Controller, Get, HttpCode, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness (processo vivo, sem dependências)' })
  live() {
    return {
      status: 'ok',
      check: 'live',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness (BD acessível); 503 se indisponível' })
  @ApiResponse({ status: 200, description: 'Pronto para receber tráfego' })
  @ApiResponse({ status: 503, description: 'Dependência crítica indisponível' })
  async ready(@Res({ passthrough: false }) res: Response) {
    const ok = await this.healthService.isDatabaseReady();
    if (!ok) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'not_ready',
        check: 'ready',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(HttpStatus.OK).json({
      status: 'ok',
      check: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  }

  @Get()
  @ApiOperation({ summary: 'Health check da aplicação' })
  @ApiResponse({ status: 200, description: 'Aplicação está saudável' })
  check() {
    return this.healthService.check();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas de latência e erro por endpoint' })
  metrics() {
    return this.healthService.metrics();
  }

  @Get('errors')
  @ApiOperation({ summary: 'Dashboard de erros por endpoint (5xx)' })
  errors() {
    return this.healthService.errors();
  }

  @Get('import-metrics')
  @ApiOperation({ summary: 'Métricas de negócio: importações e jobs assíncronos' })
  importMetrics(@Query('hours') hours?: string) {
    return this.healthService.importBusinessMetrics(
      hours ? Math.min(168, Math.max(1, Number(hours))) : 24,
    );
  }

  @Get('jobs')
  @ApiOperation({
    summary: 'Estado da fila de jobs assíncronos (monitorização / alertas)',
  })
  asyncJobsQueue() {
    return this.healthService.asyncJobsQueueStats();
  }
}
