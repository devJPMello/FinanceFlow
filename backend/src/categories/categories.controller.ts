import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoryBudgetQueryDto } from './dto/category-budget-query.dto';
import { UpsertCategoryBudgetDto } from './dto/upsert-category-budget.dto';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user.interface';
import { ParamIdDto } from '../common/dto/param-id.dto';

@ApiTags('categories')
@Controller('categories')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar nova categoria' })
  @ApiResponse({ status: 201, description: 'Categoria criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  create(
    @CurrentUser() user: UserPayload,
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(user.id, createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as categorias do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de categorias retornada com sucesso' })
  findAll(@CurrentUser() user: UserPayload, @Query() query: CategoryQueryDto) {
    return this.categoriesService.findAll(user.id, query);
  }

  @Get('forecast/expenses')
  @ApiOperation({ summary: 'Previsão de despesas por categoria (média dos últimos 3 meses)' })
  @ApiResponse({ status: 200, description: 'Projeção retornada' })
  expenseForecast(@CurrentUser() user: UserPayload) {
    return this.categoriesService.getExpenseForecast(user.id);
  }

  @Get('budgets')
  @ApiOperation({ summary: 'Listar orçamentos mensais por categoria' })
  budgets(@CurrentUser() user: UserPayload, @Query() query: CategoryBudgetQueryDto) {
    const month = query.month ?? new Date().toISOString().slice(0, 7);
    return this.categoriesService.listMonthlyBudgets(user.id, month);
  }

  @Post('budgets')
  @ApiOperation({ summary: 'Criar/atualizar orçamento mensal de categoria' })
  upsertBudget(@CurrentUser() user: UserPayload, @Body() body: UpsertCategoryBudgetDto) {
    return this.categoriesService.upsertMonthlyBudget(user.id, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar categoria por ID' })
  @ApiResponse({ status: 200, description: 'Categoria encontrada' })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  findOne(@CurrentUser() user: UserPayload, @Param() param: ParamIdDto) {
    return this.categoriesService.findOne(user.id, param.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar categoria' })
  @ApiResponse({ status: 200, description: 'Categoria atualizada com sucesso' })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  update(
    @CurrentUser() user: UserPayload,
    @Param() param: ParamIdDto,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(user.id, param.id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover categoria' })
  @ApiResponse({ status: 200, description: 'Categoria removida com sucesso' })
  @ApiResponse({ status: 400, description: 'Categoria possui transações vinculadas' })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  remove(@CurrentUser() user: UserPayload, @Param() param: ParamIdDto) {
    return this.categoriesService.remove(user.id, param.id);
  }
}
