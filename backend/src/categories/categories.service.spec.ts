import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockCache = {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
  };

  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar uma categoria com sucesso', async () => {
      const userId = 'user-1';
      const createCategoryDto = {
        name: 'Test Category',
        type: 'INCOME' as const,
        color: '#16A34A',
      };

      const mockCategory = {
        id: 'category-1',
        ...createCategoryDto,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.category.create.mockResolvedValue(mockCategory);

      const result = await service.create(userId, createCategoryDto);

      expect(result).toEqual(mockCategory);
      expect(mockPrismaService.category.create).toHaveBeenCalledWith({
        data: {
          ...createCategoryDto,
          userId,
          color: createCategoryDto.color,
        },
      });
    });

    it('deve usar cor padrão se não fornecida', async () => {
      const userId = 'user-1';
      const createCategoryDto = {
        name: 'Test Category',
        type: 'INCOME' as const,
      };

      const mockCategory = {
        id: 'category-1',
        ...createCategoryDto,
        color: '#6366f1',
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.category.create.mockResolvedValue(mockCategory);

      await service.create(userId, createCategoryDto);

      expect(mockPrismaService.category.create).toHaveBeenCalledWith({
        data: {
          ...createCategoryDto,
          userId,
          color: '#6366f1',
        },
      });
    });
  });

  describe('findAll', () => {
    it('deve retornar todas as categorias do usuário', async () => {
      const userId = 'user-1';
      const mockCategories = [
        { id: '1', name: 'Category 1', userId, type: 'INCOME' },
        { id: '2', name: 'Category 2', userId, type: 'EXPENSE' },
      ];

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories);
      mockPrismaService.category.count.mockResolvedValue(2);

      const result = await service.findAll(userId);

      expect(result.data).toEqual(mockCategories);
      expect(result.meta.total).toBe(2);
      expect(mockPrismaService.category.findMany).toHaveBeenCalled();
    });

    it('deve filtrar por tipo quando fornecido', async () => {
      const userId = 'user-1';
      const mockCategories = [
        { id: '1', name: 'Category 1', userId, type: 'INCOME' },
      ];

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories);
      mockPrismaService.category.count.mockResolvedValue(1);

      const result = await service.findAll(userId, { type: 'INCOME' });

      expect(result.data).toEqual(mockCategories);
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({
        where: { userId, type: 'INCOME' },
        orderBy: { name: 'asc' },
        skip: 0,
        take: 50,
      });
    });

    it('deve aplicar paginação corretamente', async () => {
      const userId = 'user-1';
      const mockCategories = [{ id: '1', name: 'Category 1', userId, type: 'INCOME' }];

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories);
      mockPrismaService.category.count.mockResolvedValue(100);

      const result = await service.findAll(userId, { page: 2, limit: 10 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(10);
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { name: 'asc' },
        skip: 10,
        take: 10,
      });
    });
  });

  describe('findOne', () => {
    it('deve retornar uma categoria existente', async () => {
      const userId = 'user-1';
      const categoryId = 'category-1';
      const mockCategory = {
        id: categoryId,
        name: 'Test Category',
        userId,
        type: 'INCOME',
        _count: { transactions: 0 },
      };

      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);

      const result = await service.findOne(userId, categoryId);

      expect(result).toEqual(mockCategory);
    });

    it('deve lançar NotFoundException se categoria não existe', async () => {
      const userId = 'user-1';
      const categoryId = 'non-existent';

      mockPrismaService.category.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, categoryId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar NotFoundException se categoria pertence a outro usuário (sem vazar existência)', async () => {
      const userId = 'user-1';
      const categoryId = 'category-1';

      mockPrismaService.category.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, categoryId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('deve atualizar uma categoria com sucesso', async () => {
      const userId = 'user-1';
      const categoryId = 'category-1';
      const updateDto = { name: 'Updated Category' };

      const existingCategory = {
        id: categoryId,
        name: 'Test Category',
        userId,
        type: 'INCOME',
        _count: { transactions: 0 },
      };

      const updatedCategory = {
        ...existingCategory,
        ...updateDto,
      };

      mockPrismaService.category.findFirst.mockResolvedValue(existingCategory);
      mockPrismaService.category.update.mockResolvedValue(updatedCategory);

      const result = await service.update(userId, categoryId, updateDto);

      expect(result).toEqual(updatedCategory);
      expect(mockPrismaService.category.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deve remover uma categoria sem transações', async () => {
      const userId = 'user-1';
      const categoryId = 'category-1';

      const mockCategory = {
        id: categoryId,
        name: 'Test Category',
        userId,
        type: 'INCOME',
        _count: { transactions: 0 },
      };

      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);

      const result = await service.remove(userId, categoryId);

      expect(result).toEqual(mockCategory);
      expect(mockPrismaService.category.delete).toHaveBeenCalled();
    });

    it('deve lançar BadRequestException se categoria tem transações vinculadas', async () => {
      const userId = 'user-1';
      const categoryId = 'category-1';

      const mockCategory = {
        id: categoryId,
        name: 'Test Category',
        userId,
        type: 'INCOME',
        _count: { transactions: 5 },
      };

      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);

      await expect(service.remove(userId, categoryId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.category.delete).not.toHaveBeenCalled();
    });
  });
});
