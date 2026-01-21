import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    transaction: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSummary', () => {
    it('deve retornar resumo financeiro do usuário', async () => {
      const userId = 'user-1';

      mockPrismaService.transaction.aggregate
        .mockResolvedValueOnce({
          _sum: { amount: new Decimal(5000) },
        })
        .mockResolvedValueOnce({
          _sum: { amount: new Decimal(2000) },
        });
      mockPrismaService.transaction.count.mockResolvedValue(10);

      const result = await service.getSummary(userId);

      expect(result.balance).toBe(3000);
      expect(result.totalIncome).toBe(5000);
      expect(result.totalExpense).toBe(2000);
      expect(result.transactionCount).toBe(10);
    });

    it('deve retornar zero quando não há transações', async () => {
      const userId = 'user-1';

      mockPrismaService.transaction.aggregate
        .mockResolvedValueOnce({
          _sum: { amount: null },
        })
        .mockResolvedValueOnce({
          _sum: { amount: null },
        });
      mockPrismaService.transaction.count.mockResolvedValue(0);

      const result = await service.getSummary(userId);

      expect(result.balance).toBe(0);
      expect(result.totalIncome).toBe(0);
      expect(result.totalExpense).toBe(0);
      expect(result.transactionCount).toBe(0);
    });

    it('deve filtrar por data quando fornecida', async () => {
      const userId = 'user-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrismaService.transaction.aggregate
        .mockResolvedValueOnce({
          _sum: { amount: new Decimal(1000) },
        })
        .mockResolvedValueOnce({
          _sum: { amount: new Decimal(500) },
        });
      mockPrismaService.transaction.count.mockResolvedValue(5);

      await service.getSummary(userId, startDate, endDate);

      expect(mockPrismaService.transaction.aggregate).toHaveBeenCalledWith({
        where: {
          userId,
          type: 'INCOME',
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
      });
    });
  });

  describe('getMonthlyData', () => {
    it('deve retornar dados mensais do ano', async () => {
      const userId = 'user-1';
      const year = 2024;

      const mockTransactions = [
        {
          id: '1',
          userId,
          type: 'INCOME',
          amount: new Decimal(1000),
          date: new Date(2024, 0, 15), // Janeiro
        },
        {
          id: '2',
          userId,
          type: 'EXPENSE',
          amount: new Decimal(500),
          date: new Date(2024, 0, 20), // Janeiro
        },
        {
          id: '3',
          userId,
          type: 'INCOME',
          amount: new Decimal(2000),
          date: new Date(2024, 1, 10), // Fevereiro
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getMonthlyData(userId, year);

      expect(result).toHaveLength(12);
      expect(result[0].income).toBe(1000);
      expect(result[0].expense).toBe(500);
      expect(result[1].income).toBe(2000);
      expect(result[1].expense).toBe(0);
    });

    it('deve retornar array vazio quando não há transações', async () => {
      const userId = 'user-1';
      const year = 2024;

      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      const result = await service.getMonthlyData(userId, year);

      expect(result).toHaveLength(12);
      expect(result.every((m) => m.income === 0 && m.expense === 0)).toBe(true);
    });
  });

  describe('getCategoryStats', () => {
    it('deve retornar estatísticas por categoria', async () => {
      const userId = 'user-1';

      const mockTransactions = [
        {
          id: '1',
          userId,
          categoryId: 'cat-1',
          amount: new Decimal(1000),
          category: { id: 'cat-1', name: 'Category 1' },
        },
        {
          id: '2',
          userId,
          categoryId: 'cat-1',
          amount: new Decimal(500),
          category: { id: 'cat-1', name: 'Category 1' },
        },
        {
          id: '3',
          userId,
          categoryId: 'cat-2',
          amount: new Decimal(2000),
          category: { id: 'cat-2', name: 'Category 2' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getCategoryStats(userId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Category 2');
      expect(result[0].amount).toBe(2000);
      expect(result[1].name).toBe('Category 1');
      expect(result[1].amount).toBe(1500);
    });

    it('deve filtrar por data quando fornecida', async () => {
      const userId = 'user-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      await service.getCategoryStats(userId, startDate, endDate);

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: { category: true },
      });
    });
  });
});
