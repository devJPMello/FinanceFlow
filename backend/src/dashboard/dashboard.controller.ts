import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user.interface';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Obter resumo financeiro' })
  @ApiResponse({ status: 200, description: 'Resumo retornado com sucesso' })
  getSummary(
    @CurrentUser() user: UserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.dashboardService.getSummary(user.id, start, end);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Obter dados mensais' })
  @ApiResponse({ status: 200, description: 'Dados mensais retornados com sucesso' })
  getMonthlyData(
    @CurrentUser() user: UserPayload,
    @Query('year') year?: string,
  ) {
    const yearNumber = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.dashboardService.getMonthlyData(user.id, yearNumber);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Obter estatísticas por categoria' })
  @ApiResponse({ status: 200, description: 'Estatísticas retornadas com sucesso' })
  getCategoryStats(
    @CurrentUser() user: UserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.dashboardService.getCategoryStats(user.id, start, end);
  }

  @Get('month-summary')
  @ApiOperation({ summary: 'Resumo do mês atual com variação do mês anterior' })
  getMonthSummary(@CurrentUser() user: UserPayload, @Query('month') month?: string) {
    return this.dashboardService.getMonthSummary(user.id, month);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Painel de pendências financeiras/fiscais' })
  getPendingPanel(@CurrentUser() user: UserPayload) {
    return this.dashboardService.getPendingPanel(user.id);
  }

  @Get('budget-overview')
  @ApiOperation({ summary: 'Orçamento mensal por categoria com semáforo e projeção' })
  getBudgetOverview(@CurrentUser() user: UserPayload, @Query('month') month?: string) {
    return this.dashboardService.getBudgetOverview(user.id, month);
  }

  @Get('monthly-closing')
  @ApiOperation({ summary: 'Fechamento mensal em 5 passos (checklist)' })
  monthlyClosing(@CurrentUser() user: UserPayload, @Query('month') month?: string) {
    return this.dashboardService.getMonthlyClosing(user.id, month);
  }
}
