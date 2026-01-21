import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createTransactionDto: CreateTransactionDto) {
    const { categoryId, amount, type } = createTransactionDto;

    // Verificar se a categoria existe e pertence ao usuário
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    if (category.userId !== userId) {
      throw new ForbiddenException('Categoria não pertence ao usuário');
    }

    // Verificar se o tipo da transação corresponde ao tipo da categoria
    if (category.type !== type) {
      throw new BadRequestException(
        'Tipo da transação não corresponde ao tipo da categoria',
      );
    }

    // Regra de negócio: Valor deve ser positivo
    if (amount <= 0) {
      throw new BadRequestException('Valor deve ser maior que zero');
    }

    // Criar transação
    return this.prisma.transaction.create({
      data: {
        ...createTransactionDto,
        amount: new Decimal(amount),
        userId,
        date: new Date(createTransactionDto.date),
      },
      include: {
        category: true,
      },
    });
  }

  async findAll(userId: string, query: TransactionQueryDto) {
    const where: any = { userId };

    if (query.type) {
      where.type = query.type;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.date.lte = new Date(query.endDate);
      }
    }

    // Paginação
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    if (transaction.userId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }

    return transaction;
  }

  async update(
    userId: string,
    id: string,
    updateTransactionDto: UpdateTransactionDto,
  ) {
    const transaction = await this.findOne(userId, id);

    // Se estiver atualizando categoria, verificar se existe e pertence ao usuário
    if (updateTransactionDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateTransactionDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Categoria não encontrada');
      }

      if (category.userId !== userId) {
        throw new ForbiddenException('Categoria não pertence ao usuário');
      }
    }

    // Se estiver atualizando valor, verificar se é positivo
    if (updateTransactionDto.amount !== undefined) {
      if (updateTransactionDto.amount <= 0) {
        throw new BadRequestException('Valor deve ser maior que zero');
      }
    }

    const updateData: any = { ...updateTransactionDto };

    if (updateData.amount !== undefined) {
      updateData.amount = new Decimal(updateData.amount);
    }

    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    return this.prisma.transaction.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.transaction.delete({
      where: { id },
    });
  }

  async getBalance(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
    });

    let balance = new Decimal(0);

    transactions.forEach((transaction) => {
      if (transaction.type === 'INCOME') {
        balance = balance.add(transaction.amount);
      } else {
        balance = balance.sub(transaction.amount);
      }
    });

    return {
      balance: balance.toNumber(),
    };
  }
}
