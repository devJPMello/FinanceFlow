import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { MetricsService } from './common/services/metrics.service';
import { assertProductionEnv } from './common/config/production-env';

async function bootstrap() {
  assertProductionEnv();
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  if (process.env.NODE_ENV === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  const sentryDsn = process.env.SENTRY_DSN?.trim();
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
    });
    logger.log('Sentry inicializado');
  }

  const metricsService = app.get(MetricsService);
  app.use((req: Request & { requestId?: string }, res: Response, next) => {
    const startedAt = Date.now();
    const requestId = (req.headers['x-request-id'] as string | undefined)?.trim() || randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      void metricsService.recordEndpointMetric({
        method: req.method,
        route: req.originalUrl || req.url || 'unknown',
        statusCode: res.statusCode,
        latencyMs: durationMs,
        requestId,
      });
      logger.log(
        JSON.stringify({
          msg: 'http_request',
          requestId,
          method: req.method,
          path: req.originalUrl || req.url,
          statusCode: res.statusCode,
          durationMs,
        }),
      );
    });
    next();
  });

  // CORS: URL do static no Render (ou localhost). Vários hosts: separar por vírgula.
  const corsOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
  const allowedOrigins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  const corsValue =
    allowedOrigins.length === 0
      ? 'http://localhost:5173'
      : allowedOrigins.length === 1
        ? allowedOrigins[0]
        : allowedOrigins;
  app.enableCors({
    origin: corsValue,
    credentials: true,
  });

  // Prefixo global para todas as rotas
  app.setGlobalPrefix('api');

  // Validação global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const enableSwagger =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER_IN_PROD === 'true';

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('FinanceFlow API')
      .setDescription('API REST para plataforma de gestão financeira pessoal')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Clerk',
          description: 'Token de sessão do Clerk (header Authorization)',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('users', 'Gerenciamento de usuários')
      .addTag('transactions', 'Transações financeiras')
      .addTag('categories', 'Categorias de transações')
      .addTag('goals', 'Metas financeiras')
      .addTag('dashboard', 'Dashboard e relatórios')
      .addTag('tax-insights', 'TaxVision — visão fiscal e deduções')
      .addTag('ai-insights', 'Comentários com IA (Gemini)')
      .addTag('health', 'Health check e monitoramento')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  } else {
    logger.log(
      'Swagger desativado em produção (ENABLE_SWAGGER_IN_PROD=true para expor /api/docs)',
    );
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Backend rodando em http://localhost:${port}`);
  logger.log(`📚 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`📖 Swagger disponível em http://localhost:${port}/api/docs`);
}
bootstrap();
