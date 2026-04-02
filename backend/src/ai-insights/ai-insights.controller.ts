import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user.interface';
import { TaxYearQueryDto } from '../tax-insights/dto/tax-year-query.dto';
import { AiInsightsService } from './ai-insights.service';
import { FeatureFlagsService } from '../common/services/feature-flags.service';

@ApiTags('ai-insights')
@Controller('ai-insights')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AiInsightsController {
  constructor(
    private readonly aiInsightsService: AiInsightsService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Post('forecast-commentary')
  @ApiOperation({
    summary: 'Comentário IA (Gemini) sobre a previsão de despesas do utilizador',
  })
  @ApiResponse({ status: 200, description: 'Texto gerado pelo modelo' })
  @ApiResponse({ status: 400, description: 'GEMINI_API_KEY em falta' })
  @ApiResponse({ status: 502, description: 'Falha na API Gemini' })
  forecastCommentary(@CurrentUser() user: UserPayload) {
    return this.aiInsightsService.forecastCommentary(user.id);
  }

  @Post('tax-commentary')
  @ApiOperation({
    summary:
      'Comentário IA (Gemini) sobre organização fiscal (sem aconselhamento legal)',
  })
  @ApiResponse({ status: 200, description: 'Texto gerado pelo modelo' })
  @ApiResponse({ status: 400, description: 'GEMINI_API_KEY em falta' })
  @ApiResponse({ status: 502, description: 'Falha na API Gemini' })
  taxCommentary(
    @CurrentUser() user: UserPayload,
    @Query() query: TaxYearQueryDto,
  ) {
    return this.aiInsightsService.taxOrganizationCommentary(user.id, query.year);
  }

  @Get('taxvision/classification-suggestions')
  @ApiOperation({ summary: 'Sugestões IA para marcação IR por transação' })
  getClassification(
    @CurrentUser() user: UserPayload,
    @Query() query: TaxYearQueryDto & { limit?: number },
  ) {
    return this.aiInsightsService.getTaxClassificationSuggestions(
      user.id,
      query.year,
      query.limit,
    );
  }

  @Post('taxvision/classification-decision')
  @ApiOperation({ summary: 'Aceitar/rejeitar sugestão fiscal de uma transação' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string' },
        decision: { type: 'string', enum: ['accept', 'reject'] },
      },
      required: ['transactionId', 'decision'],
    },
  })
  classificationDecision(
    @CurrentUser() user: UserPayload,
    @Body() body: { transactionId: string; decision: 'accept' | 'reject' },
  ) {
    return this.aiInsightsService.applyTaxClassificationDecision(
      user.id,
      body.transactionId,
      body.decision,
    );
  }

  @Get('taxvision/checklist')
  @ApiOperation({ summary: 'Checklist fiscal anual com pendências' })
  checklist(@CurrentUser() user: UserPayload, @Query() query: TaxYearQueryDto) {
    return this.aiInsightsService.getTaxChecklist(user.id, query.year);
  }

  @Get('taxvision/document-timeline')
  @ApiOperation({ summary: 'Timeline documental do baú fiscal' })
  documentTimeline(
    @CurrentUser() user: UserPayload,
    @Query() query: TaxYearQueryDto,
  ) {
    return this.aiInsightsService.getDocumentTimeline(user.id, query.year);
  }

  @Post('taxvision/ocr/:attachmentId')
  @ApiOperation({
    summary:
      'OCR de comprovante (PDF/imagem) e sugestão de vínculo com transações',
  })
  @ApiParam({ name: 'attachmentId', required: true })
  ocrAttachment(
    @CurrentUser() user: UserPayload,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.aiInsightsService.ocrAttachment(user.id, attachmentId);
  }

  @Get('taxvision/audit-report.csv')
  @ApiOperation({ summary: 'Relatório de auditoria pessoal em CSV' })
  async auditCsv(
    @CurrentUser() user: UserPayload,
    @Query() query: TaxYearQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.aiInsightsService.getAuditReportCsv(user.id, query.year);
    const y = query.year ?? new Date().getFullYear();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="taxvision-auditoria-${y}.csv"`,
    );
    return `\ufeff${csv}`;
  }

  @Get('taxvision/audit-report.pdf')
  @ApiOperation({ summary: 'Relatório de auditoria pessoal em PDF' })
  async auditPdf(
    @CurrentUser() user: UserPayload,
    @Query() query: TaxYearQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.aiInsightsService.getAuditReportPdfBuffer(
      user.id,
      query.year,
    );
    const y = query.year ?? new Date().getFullYear();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="taxvision-auditoria-${y}.pdf"`,
    );
    return new StreamableFile(pdf);
  }

  @Post('taxvision/category-suggestion')
  @ApiOperation({ summary: 'Sugerir categoria com aprendizado do usuário' })
  suggestCategory(
    @CurrentUser() user: UserPayload,
    @Body() body: { description: string; type: 'INCOME' | 'EXPENSE' },
  ) {
    return this.aiInsightsService.suggestCategoryWithLearning(user.id, body);
  }

  @Post('taxvision/category-suggestion-feedback')
  @ApiOperation({ summary: 'Registrar feedback de sugestão de categoria (aceitar/rejeitar)' })
  categorySuggestionFeedback(
    @CurrentUser() user: UserPayload,
    @Body()
    body: {
      description: string;
      type: 'INCOME' | 'EXPENSE';
      categoryId: string;
      decision: 'accept' | 'reject';
    },
  ) {
    return this.aiInsightsService.registerCategorySuggestionFeedback(user.id, body);
  }

  @Get('taxvision/weekly-summary')
  @ApiOperation({ summary: 'Resumo financeiro semanal via IA (3 insights + 3 ações)' })
  async weeklySummary(
    @CurrentUser() user: UserPayload,
    @Query('weekStart') weekStart?: string,
  ) {
    const ok = await this.featureFlags.isEnabled(user.id, 'taxvision.weekly-summary', true);
    if (!ok) {
      const today = new Date().toISOString().slice(0, 10);
      return { weekStart: today, weekEnd: today, insights: [], actions: [] };
    }
    return this.aiInsightsService.getWeeklyFinancialSummary(user.id, weekStart);
  }

  @Post('taxvision/recurring-detect')
  @ApiOperation({ summary: 'Detectar recorrências/assinaturas automaticamente' })
  async recurringDetect(@CurrentUser() user: UserPayload) {
    const ok = await this.featureFlags.isEnabled(user.id, 'taxvision.recurring', true);
    if (!ok) return { count: 0, hints: [] };
    return this.aiInsightsService.detectRecurringSubscriptions(user.id);
  }

  @Post('taxvision/suggestion-dismiss')
  @ApiOperation({ summary: 'Não mostrar de novo esta sugestão (ex.: tax-classify:transactionId)' })
  dismissSuggestion(
    @CurrentUser() user: UserPayload,
    @Body() body: { key: string },
  ) {
    return this.aiInsightsService.registerSuggestionDismissal(user.id, body.key);
  }

  @Post('taxvision/mark-subscription')
  @ApiOperation({ summary: 'Marcar transação como assinatura recorrente' })
  markSubscription(
    @CurrentUser() user: UserPayload,
    @Body() body: { transactionId: string; enabled?: boolean },
  ) {
    return this.aiInsightsService.markAsSubscription(
      user.id,
      body.transactionId,
      body.enabled ?? true,
    );
  }
}
