import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as Sentry from '@sentry/node';
import { getRequestIdFromContext } from '../request-context';

function normalizeErrorMessage(message: unknown): string | string[] | undefined {
  if (message == null) return undefined;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map((m) => String(m));
  if (typeof message === 'object' && message !== null && 'message' in message) {
    return normalizeErrorMessage((message as { message: unknown }).message);
  }
  return String(message);
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const requestId = getRequestIdFromContext(request);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!(exception instanceof HttpException)) {
      const trace =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `${request.method ?? '?'} ${request.url} → ${status}: ${trace}`,
      );
      Sentry.captureException(exception, {
        tags: { route: request.url || 'unknown', method: request.method || 'unknown' },
        extra: { requestId },
      });
    }

    const rawResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Erro interno do servidor';

    let message: string | string[];
    if (typeof rawResponse === 'string') {
      message = rawResponse;
    } else if (typeof rawResponse === 'object' && rawResponse !== null) {
      const norm = normalizeErrorMessage((rawResponse as { message?: unknown }).message);
      message = norm ?? 'Erro na solicitação';
    } else {
      message = 'Erro interno do servidor';
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      message,
    });
  }
}
