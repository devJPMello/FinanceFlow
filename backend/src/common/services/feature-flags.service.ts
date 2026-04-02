import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  private rolloutHit(userId: string, key: string, pct: number) {
    const bucket = Number(
      createHash('sha256').update(`${userId}:${key}`).digest('hex').slice(0, 8),
    ) % 100;
    return bucket < Math.max(0, Math.min(100, pct));
  }

  async isEnabled(userId: string, key: string, defaultEnabled = false) {
    const row = await this.prisma.$queryRawUnsafe<
      Array<{ enabled: boolean; rolloutPct: number }>
    >(
      `SELECT "enabled","rolloutPct" FROM feature_flags WHERE "key" = $1 LIMIT 1`,
      key,
    );
    if (!row.length) return defaultEnabled;
    const cfg = row[0];
    if (!cfg.enabled) return false;
    if ((cfg.rolloutPct ?? 100) >= 100) return true;
    return this.rolloutHit(userId, key, cfg.rolloutPct ?? 0);
  }
}
