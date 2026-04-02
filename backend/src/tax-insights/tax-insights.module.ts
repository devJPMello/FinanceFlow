import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TaxInsightsService } from './tax-insights.service';
import { TaxInsightsController } from './tax-insights.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TaxInsightsController],
  providers: [TaxInsightsService],
  exports: [TaxInsightsService],
})
export class TaxInsightsModule {}
