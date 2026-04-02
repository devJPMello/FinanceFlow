import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId: string;
    actorUserId?: string;
    entity: string;
    entityId: string;
    action: string;
    beforeJson?: unknown;
    afterJson?: unknown;
    requestId?: string;
  }) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO audit_logs ("id","userId","actorUserId","entity","entityId","action","beforeJson","afterJson","requestId","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,NOW())`,
      randomUUID(),
      params.userId,
      params.actorUserId ?? null,
      params.entity,
      params.entityId,
      params.action,
      params.beforeJson ? JSON.stringify(params.beforeJson) : null,
      params.afterJson ? JSON.stringify(params.afterJson) : null,
      params.requestId ?? null,
    );
  }
}
