import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user.interface';
import { TaxInsightsService } from './tax-insights.service';
import { TaxYearQueryDto } from './dto/tax-year-query.dto';

@ApiTags('tax-insights')
@Controller('tax-insights')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TaxInsightsController {
  constructor(private readonly taxInsightsService: TaxInsightsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumo TaxVision: despesas com potencial dedução no ano' })
  @ApiResponse({ status: 200, description: 'Resumo retornado' })
  summary(@CurrentUser() user: UserPayload, @Query() query: TaxYearQueryDto) {
    return this.taxInsightsService.getYearSummary(user.id, query.year);
  }
}
