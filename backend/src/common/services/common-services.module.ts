import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { AuditService } from './audit.service';
import { MetricsService } from './metrics.service';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FeatureFlagsController],
  providers: [AuditService, MetricsService, FeatureFlagsService],
  exports: [AuditService, MetricsService, FeatureFlagsService],
})
export class CommonServicesModule {}
