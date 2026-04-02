import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Processo dedicado à fila assíncrona (import PDF / OCR / resumo).
 * Rode a API com DISABLE_JOB_POLLER=true para evitar dois pollers no mesmo ambiente.
 */
async function bootstrap() {
  const logger = new Logger('AsyncWorker');
  const app = await NestFactory.createApplicationContext(AppModule);
  logger.log(
    'Worker ativo (sem HTTP). Confirme DISABLE_JOB_POLLER=true na API se ambos correm em paralelo.',
  );
}

void bootstrap();
