import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar uma transação com sucesso', async () => {
      const userId = 'user-1';
      const createTransactionDto = {
        type: 'INCOME' as const,
        amount: 1000,
        description: 'Test transaction',
        date: new Date().toISOString(),
        categoryId: 'category-1',
      };

      const mockCategory = {
        id: 'category-1',
        type: 'INCOME',
        userId,
      };

      const mockTransaction = {
        id: 'transaction-1',
        ...createTransactionDto,
        amount: new Decimal(createTransactionDto.amount),
        userId,
        category: mockCategory,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.transaction.create.mockResolvedValue(mockTransaction);

      const result = await service.create(userId, createTransactionDto);

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaService.transaction.create).toHaveBeenCalled();
    });

    it('deve lançar BadRequestException se valor for zero ou negativo', async () => {
      const userId = 'user-1';
      const createTransactionDto = {
        type: 'INCOME' as const,
        amount: 0,
        description: 'Test transaction',
        date: new Date().toISOString(),
        categoryId: 'category-1',
      };

      await expect(service.create(userId, createTransactionDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lançar BadRequestException se tipo de categoria não corresponder', async () => {
      const userId = 'user-1';
      const createTransactionDto = {
        type: 'INCOME' as const,
        amount: 1000,
        description: 'Test transaction',
        date: new Date().toISOString(),
        categoryId: 'category-1',
      };

      const mockCategory = {
        id: 'category-1',
        type: 'EXPENSE',
        userId,
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

      await expect(service.create(userId, createTransactionDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('deve retornar todas as transações do usuário', async () => {
      const userId = 'user-1';
      const mockTransactions = [
        {
          id: '1',
          userId,
          type: 'INCOME',
          amount: new Decimal(1000),
          category: { id: 'cat-1', name: 'Category 1' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result = await service.findAll(userId, {});

      expect(result.data).toEqual(mockTransactions);
      expect(result.pagination.total).toBe(1);
    });

    it('deve filtrar por tipo quando fornecido', async () => {
      const userId = 'user-1';
      const mockTransactions = [
        {
          id: '1',
          userId,
          type: 'INCOME',
          amount: new Decimal(1000),
          category: { id: 'cat-1', name: 'Category 1' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result = await service.findAll(userId, { type: 'INCOME' });

      expect(result.data).toEqual(mockTransactions);
    });

    it('deve aplicar paginação corretamente', async () => {
      const userId = 'user-1';
      const mockTransactions = [
        {
          id: '1',
          userId,
          type: 'INCOME',
          amount: new Decimal(1000),
          category: { id: 'cat-1', name: 'Category 1' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.transaction.count.mockResolvedValue(100);

      const result = await service.findAll(userId, { page: 2, limit: 10 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.totalPages).toBe(10);
    });
  });

  describe('findOne', () => {
    it('deve retornar uma transação existente', async () => {
      const userId = 'user-1';
      const transactionId = 'transaction-1';

      const mockTransaction = {
        id: transactionId,
        userId,
        type: 'INCOME',
        amount: new Decimal(1000),
        category: { id: 'category-1', name: 'Test Category' },
      };

      mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);

      const result = await service.findOne(userId, transactionId);

      expect(result).toEqual(mockTransaction);
    });

    it('deve lançar NotFoundException se transação não existe', async () => {
      const userId = 'user-1';
      const transactionId = 'non-existent';

      mockPrismaService.transaction.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, transactionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar ForbiddenException se transação pertence a outro usuário', async () => {
      const userId = 'user-1';
      const transactionId = 'transaction-1';

      const mockTransaction = {
        id: transactionId,
        userId: 'other-user',
        type: 'INCOME',
        amount: new Decimal(1000),
        category: { id: 'category-1', name: 'Test Category' },
      };

      mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);

      await expect(service.findOne(userId, transactionId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('deve atualizar uma transação com sucesso', async () => {
      const userId = 'user-1';
      const transactionId = 'transaction-1';
      const updateDto = { amount: 2000 };

      const existingTransaction = {
        id: transactionId,
        userId,
        type: 'INCOME',
        amount: new Decimal(1000),
        category: { id: 'category-1', type: 'INCOME', userId },
      };

      const updatedTransaction = {
        ...existingTransaction,
        amount: new Decimal(updateDto.amount),
      };

      mockPrismaService.transaction.findUnique.mockResolvedValue(existingTransaction);
      mockPrismaService.transaction.update.mockResolvedValue(updatedTransaction);

      const result = await service.update(userId, transactionId, updateDto);

      expect(result).toEqual(updatedTransaction);
    });

    it('deve lançar BadRequestException se valor for zero ou negativo', async () => {
      const userId = 'user-1';
      const transactionId = 'transaction-1';
      const updateDto = { amount: 0 };

      const existingTransaction = {
        id: transactionId,
        userId,
        type: 'INCOME',
        amount: new Decimal(1000),
        category: { id: 'category-1', type: 'INCOME', userId },
      };

      mockPrismaService.transaction.findUnique.mockResolvedValue(existingTransaction);

      await expect(service.update(userId, transactionId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('deve remover uma transação com sucesso', async () => {
      const userId = 'user-1';
      const transactionId = 'transaction-1';

      const existingTransaction = {
        id: transactionId,
        userId,
        type: 'INCOME',
        amount: new Decimal(1000),
        category: { id: 'category-1', name: 'Test Category' },
      };

      mockPrismaService.transaction.findUnique.mockResolvedValue(existingTransaction);
      mockPrismaService.transaction.delete.mockResolvedValue(existingTransaction);

      const result = await service.remove(userId, transactionId);

      expect(result).toEqual(existingTransaction);
      expect(mockPrismaService.transaction.delete).toHaveBeenCalled();
    });
  });
});
