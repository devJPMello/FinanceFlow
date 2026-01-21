import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user.interface';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(CacheInterceptor)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @CacheKey('dashboard-summary')
  @CacheTTL(300000) // 5 minutos
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
  @CacheKey('dashboard-monthly')
  @CacheTTL(300000) // 5 minutos
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
  @CacheKey('dashboard-categories')
  @CacheTTL(300000) // 5 minutos
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
}
