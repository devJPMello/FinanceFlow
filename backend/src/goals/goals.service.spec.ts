import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('GoalsService', () => {
  let service: GoalsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    goal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar uma meta com sucesso', async () => {
      const userId = 'user-1';
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const createGoalDto = {
        title: 'Test Goal',
        targetAmount: 1000,
        deadline: futureDate.toISOString(),
      };

      const mockGoal = {
        id: 'goal-1',
        ...createGoalDto,
        targetAmount: new Decimal(1000),
        currentAmount: new Decimal(0),
        deadline: futureDate,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.goal.create.mockResolvedValue(mockGoal);

      const result = await service.create(userId, createGoalDto);

      expect(result).toEqual(mockGoal);
      expect(mockPrismaService.goal.create).toHaveBeenCalled();
    });

    it('deve lançar BadRequestException se data não for futura', async () => {
      const userId = 'user-1';
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const createGoalDto = {
        title: 'Test Goal',
        targetAmount: 1000,
        deadline: pastDate.toISOString(),
      };

      await expect(service.create(userId, createGoalDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lançar BadRequestException se valor-alvo for zero ou negativo', async () => {
      const userId = 'user-1';
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const createGoalDto = {
        title: 'Test Goal',
        targetAmount: 0,
        deadline: futureDate.toISOString(),
      };

      await expect(service.create(userId, createGoalDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('deve retornar todas as metas do usuário', async () => {
      const userId = 'user-1';
      const mockGoals = [
        {
          id: '1',
          title: 'Goal 1',
          userId,
          targetAmount: new Decimal(1000),
          currentAmount: new Decimal(500),
          deadline: new Date(),
        },
      ];

      mockPrismaService.goal.findMany.mockResolvedValue(mockGoals);
      mockPrismaService.goal.count.mockResolvedValue(1);

      const result = await service.findAll(userId);

      expect(result.data).toEqual(mockGoals);
      expect(result.meta.total).toBe(1);
    });

    it('deve aplicar paginação corretamente', async () => {
      const userId = 'user-1';
      const mockGoals = [
        {
          id: '1',
          title: 'Goal 1',
          userId,
          targetAmount: new Decimal(1000),
          currentAmount: new Decimal(500),
          deadline: new Date(),
        },
      ];

      mockPrismaService.goal.findMany.mockResolvedValue(mockGoals);
      mockPrismaService.goal.count.mockResolvedValue(50);

      const result = await service.findAll(userId, { page: 2, limit: 10 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
    });
  });

  describe('findOne', () => {
    it('deve retornar uma meta existente', async () => {
      const userId = 'user-1';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        title: 'Test Goal',
        userId,
        targetAmount: new Decimal(1000),
        currentAmount: new Decimal(500),
        deadline: new Date(),
      };

      mockPrismaService.goal.findUnique.mockResolvedValue(mockGoal);

      const result = await service.findOne(userId, goalId);

      expect(result).toEqual(mockGoal);
    });

    it('deve lançar NotFoundException se meta não existe', async () => {
      const userId = 'user-1';
      const goalId = 'non-existent';

      mockPrismaService.goal.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, goalId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar ForbiddenException se meta pertence a outro usuário', async () => {
      const userId = 'user-1';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        title: 'Test Goal',
        userId: 'other-user',
        targetAmount: new Decimal(1000),
        currentAmount: new Decimal(500),
        deadline: new Date(),
      };

      mockPrismaService.goal.findUnique.mockResolvedValue(mockGoal);

      await expect(service.findOne(userId, goalId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('deve atualizar uma meta com sucesso', async () => {
      const userId = 'user-1';
      const goalId = 'goal-1';
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const existingGoal = {
        id: goalId,
        title: 'Test Goal',
        userId,
        targetAmount: new Decimal(1000),
        currentAmount: new Decimal(500),
        deadline: new Date(),
      };

      const updateDto = { title: 'Updated Goal' };
      const updatedGoal = { ...existingGoal, ...updateDto };

      mockPrismaService.goal.findUnique.mockResolvedValue(existingGoal);
      mockPrismaService.goal.update.mockResolvedValue(updatedGoal);

      const result = await service.update(userId, goalId, updateDto);

      expect(result).toEqual(updatedGoal);
    });

    it('deve validar data futura ao atualizar', async () => {
      const userId = 'user-1';
      const goalId = 'goal-1';
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const existingGoal = {
        id: goalId,
        title: 'Test Goal',
        userId,
        targetAmount: new Decimal(1000),
        currentAmount: new Decimal(500),
        deadline: new Date(),
      };

      const updateDto = { deadline: pastDate.toISOString() };

      mockPrismaService.goal.findUnique.mockResolvedValue(existingGoal);

      await expect(service.update(userId, goalId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve validar valor-alvo positivo ao atualizar', async () => {
      const userId = 'user-1';
      const goalId = 'goal-1';

      const existingGoal = {
        id: goalId,
        title: 'Test Goal',
        userId,
        targetAmount: new Decimal(1000),
        currentAmount: new Decimal(500),
        deadline: new Date(),
      };

      const updateDto = { targetAmount: -100 };

      mockPrismaService.goal.findUnique.mockResolvedValue(existingGoal);

      await expect(service.update(userId, goalId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateProgress', () => {
    it('deve atualizar progresso da meta', async () => {
      const userId = 'user-1';
      const goalId = 'goal-1';

      const existingGoal = {
        id: goalId,
        title: 'Test Goal',
        userId,
        targetAmount: new Decimal(1000),
        currentAmount: new Decimal(500),
        deadline: new Date(),
      };

      const updatedGoal = {
        ...existingGoal,
        currentAmount: new Decimal(600),
      };

      mockPrismaService.goal.findUnique.mockResolvedValue(existingGoal);
      mockPrismaService.goal.update.mockResolvedValue(updatedGoal);

      const result = await service.updateProgress(userId, goalId, 100);

      expect(result).toEqual(updatedGoal);
    });

    it('não deve permitir que valor atual exceda valor-alvo', async () => {
      const userId = 'user-1';
      const goalId = 'goal-1';

      const existingGoal = {
        id: goalId,
        title: 'Test Goal',
        userId,
        targetAmount: new Decimal(1000),
        currentAmount: new Decimal(950),
        deadline: new Date(),
      };

      const updatedGoal = {
        ...existingGoal,
        currentAmount: new Decimal(1000), // Não excede o target
      };

      mockPrismaService.goal.findUnique.mockResolvedValue(existingGoal);
      mockPrismaService.goal.update.mockResolvedValue(updatedGoal);

      const result = await service.updateProgress(userId, goalId, 200);

      expect(result.currentAmount).toEqual(new Decimal(1000));
    });
  });

  describe('remove', () => {
    it('deve remover uma meta com sucesso', async () => {
      const userId = 'user-1';
      const goalId = 'goal-1';

      const existingGoal = {
        id: goalId,
        title: 'Test Goal',
        userId,
        targetAmount: new Decimal(1000),
        currentAmount: new Decimal(500),
        deadline: new Date(),
      };

      mockPrismaService.goal.findUnique.mockResolvedValue(existingGoal);
      mockPrismaService.goal.delete.mockResolvedValue(existingGoal);

      const result = await service.remove(userId, goalId);

      expect(result).toEqual(existingGoal);
      expect(mockPrismaService.goal.delete).toHaveBeenCalled();
    });
  });
});
