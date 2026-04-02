import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AiInsightsModule } from '../ai-insights/ai-insights.module';
import { AsyncJobsController } from './async-jobs.controller';
import { AsyncJobsService } from './async-jobs.service';

@Module({
  imports: [AuthModule, PrismaModule, TransactionsModule, AiInsightsModule],
  controllers: [AsyncJobsController],
  providers: [AsyncJobsService],
  exports: [AsyncJobsService],
})
export class AsyncJobsModule {}
