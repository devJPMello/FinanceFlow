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
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalQueryDto } from './dto/goal-query.dto';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user.interface';
import { ParamIdDto } from '../common/dto/param-id.dto';

@ApiTags('goals')
@Controller('goals')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar nova meta financeira' })
  @ApiResponse({ status: 201, description: 'Meta criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  create(@CurrentUser() user: UserPayload, @Body() createGoalDto: CreateGoalDto) {
    return this.goalsService.create(user.id, createGoalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as metas do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de metas retornada com sucesso' })
  findAll(@CurrentUser() user: UserPayload, @Query() query: GoalQueryDto) {
    return this.goalsService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar meta por ID' })
  @ApiResponse({ status: 200, description: 'Meta encontrada' })
  @ApiResponse({ status: 404, description: 'Meta não encontrada' })
  findOne(@CurrentUser() user: UserPayload, @Param() param: ParamIdDto) {
    return this.goalsService.findOne(user.id, param.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar meta financeira' })
  @ApiResponse({ status: 200, description: 'Meta atualizada com sucesso' })
  @ApiResponse({ status: 404, description: 'Meta não encontrada' })
  update(
    @CurrentUser() user: UserPayload,
    @Param() param: ParamIdDto,
    @Body() updateGoalDto: UpdateGoalDto,
  ) {
    return this.goalsService.update(user.id, param.id, updateGoalDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover meta financeira' })
  @ApiResponse({ status: 200, description: 'Meta removida com sucesso' })
  @ApiResponse({ status: 404, description: 'Meta não encontrada' })
  remove(@CurrentUser() user: UserPayload, @Param() param: ParamIdDto) {
    return this.goalsService.remove(user.id, param.id);
  }
}
