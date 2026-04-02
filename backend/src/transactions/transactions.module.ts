import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { AuthModule } from '../auth/auth.module';
import { AiInsightsModule } from '../ai-insights/ai-insights.module';
import { CommonServicesModule } from '../common/services/common-services.module';
import { AttachmentScannerService } from './attachment-scanner.service';

@Module({
  imports: [AuthModule, AiInsightsModule, CommonServicesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, AttachmentScannerService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
