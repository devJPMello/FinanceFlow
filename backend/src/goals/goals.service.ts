import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createGoalDto: CreateGoalDto) {
    const { deadline, targetAmount } = createGoalDto;

    // Regra de negócio: Data deve ser futura
    const deadlineDate = new Date(deadline);
    const now = new Date();

    if (deadlineDate <= now) {
      throw new BadRequestException('Data limite deve ser uma data futura');
    }

    // Regra de negócio: Valor-alvo deve ser positivo
    if (targetAmount <= 0) {
      throw new BadRequestException('Valor-alvo deve ser maior que zero');
    }

    return this.prisma.goal.create({
      data: {
        ...createGoalDto,
        targetAmount: new Decimal(targetAmount),
        currentAmount: new Decimal(0),
        deadline: deadlineDate,
        userId,
      },
    });
  }

  async findAll(userId: string, query?: { page?: number; limit?: number }) {
    // Paginação
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.goal.findMany({
        where: { userId },
        orderBy: { deadline: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.goal.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
    });

    if (!goal) {
      throw new NotFoundException('Meta não encontrada');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }

    return goal;
  }

  async update(userId: string, id: string, updateGoalDto: UpdateGoalDto) {
    await this.findOne(userId, id);

    const updateData: any = { ...updateGoalDto };

    // Validar data se estiver sendo atualizada
    if (updateData.deadline) {
      const deadlineDate = new Date(updateData.deadline);
      const now = new Date();

      if (deadlineDate <= now) {
        throw new BadRequestException('Data limite deve ser uma data futura');
      }

      updateData.deadline = deadlineDate;
    }

    // Validar valor-alvo se estiver sendo atualizado
    if (updateData.targetAmount !== undefined) {
      if (updateData.targetAmount <= 0) {
        throw new BadRequestException('Valor-alvo deve ser maior que zero');
      }

      updateData.targetAmount = new Decimal(updateData.targetAmount);
    }

    return this.prisma.goal.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.goal.delete({
      where: { id },
    });
  }

  async updateProgress(userId: string, id: string, amount: number) {
    const goal = await this.findOne(userId, id);

    const newCurrentAmount = goal.currentAmount.add(new Decimal(amount));

    // Não permitir que o valor atual exceda o valor-alvo
    const targetAmount = goal.targetAmount;
    const finalAmount = newCurrentAmount.gt(targetAmount)
      ? targetAmount
      : newCurrentAmount;

    return this.prisma.goal.update({
      where: { id },
      data: {
        currentAmount: finalAmount,
      },
    });
  }
}
