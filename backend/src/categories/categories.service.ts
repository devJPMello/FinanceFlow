import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createCategoryDto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        ...createCategoryDto,
        userId,
        color: createCategoryDto.color || '#6366f1',
      },
    });
  }

  async findAll(userId: string, query?: { type?: string; page?: number; limit?: number }) {
    const where: any = { userId };

    if (query?.type && (query.type === 'INCOME' || query.type === 'EXPENSE')) {
      where.type = query.type;
    }

    // Paginação
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
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
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    if (category.userId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }

    return category;
  }

  async update(userId: string, id: string, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(userId, id);

    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async remove(userId: string, id: string) {
    const category = await this.findOne(userId, id);

    // Regra de negócio: Não pode remover categoria com transações vinculadas
    if (category._count.transactions > 0) {
      throw new BadRequestException(
        'Não é possível remover categoria com transações vinculadas',
      );
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }
}
