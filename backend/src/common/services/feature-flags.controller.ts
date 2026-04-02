import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserPayload } from '../interfaces/user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureFlagsService } from './feature-flags.service';

@ApiTags('feature-flags')
@Controller('feature-flags')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FeatureFlagsController {
  constructor(
    private readonly flags: FeatureFlagsService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get(':key')
  @ApiOperation({ summary: 'Consultar flag para o usuário atual' })
  async getFlag(@CurrentUser() user: UserPayload, @Param('key') key: string) {
    const enabled = await this.flags.isEnabled(user.id, key, false);
    return { key, enabled };
  }

  @Post(':key')
  @ApiOperation({ summary: 'Criar/atualizar flag (uso administrativo)' })
  @ApiHeader({
    name: 'x-admin-operations-secret',
    description: 'Deve coincidir com ADMIN_OPERATIONS_SECRET no servidor',
    required: true,
  })
  async upsertFlag(
    @Headers('x-admin-operations-secret') adminSecret: string | undefined,
    @Param('key') key: string,
    @Body() body: { enabled?: boolean; rolloutPct?: number; description?: string },
  ) {
    const expected = this.config.get<string>('ADMIN_OPERATIONS_SECRET')?.trim();
    if (!expected || (adminSecret || '').trim() !== expected) {
      throw new ForbiddenException('Operação administrativa negada');
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO feature_flags ("id","key","enabled","rolloutPct","description","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
       ON CONFLICT ("key")
       DO UPDATE SET "enabled"=$3,"rolloutPct"=$4,"description"=$5,"updatedAt"=NOW()`,
      randomUUID(),
      key,
      body.enabled ?? false,
      Math.max(0, Math.min(100, Number(body.rolloutPct ?? 100))),
      body.description ?? null,
    );
    return { ok: true };
  }
}
