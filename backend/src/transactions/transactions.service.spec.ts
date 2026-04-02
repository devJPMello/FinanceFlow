import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiInsightsService } from '../ai-insights/ai-insights.service';
import { AuditService } from '../common/services/audit.service';
import { AttachmentScannerService } from './attachment-scanner.service';
import { Decimal } from '@prisma/client/runtime/library';
import { ATTACHMENT_MAX_FILE_BYTES } from '../common/constants/upload-limits';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

describe('TransactionsService', () => {
  let service: TransactionsService;

  const mockAiInsightsService = {
    extractBankTransactionsFromMedia: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(() => Promise.resolve()),
  };

  const mockAttachmentScanner = {
    scanOrThrow: jest.fn(() => Promise.resolve()),
  };

  const mockCacheManager = {
    reset: jest.fn(() => Promise.resolve()),
  };

  const mockPrismaService = {
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    transactionAttachment: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AiInsightsService, useValue: mockAiInsightsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: AttachmentScannerService, useValue: mockAttachmentScanner },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
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

      mockPrismaService.transaction.findFirst.mockResolvedValue(mockTransaction);

      const result = await service.findOne(userId, transactionId);

      expect(result).toEqual(mockTransaction);
    });

    it('deve lançar NotFoundException se transação não existe', async () => {
      const userId = 'user-1';
      const transactionId = 'non-existent';

      mockPrismaService.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, transactionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar NotFoundException se transação pertence a outro usuário (sem vazar existência)', async () => {
      const userId = 'user-1';
      const transactionId = 'transaction-1';

      mockPrismaService.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, transactionId)).rejects.toThrow(
        NotFoundException,
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

      mockPrismaService.transaction.findFirst.mockResolvedValue(existingTransaction);
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

      mockPrismaService.transaction.findFirst.mockResolvedValue(existingTransaction);

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

      mockPrismaService.transaction.findFirst.mockResolvedValue(existingTransaction);
      mockPrismaService.transaction.delete.mockResolvedValue(existingTransaction);

      const result = await service.remove(userId, transactionId);

      expect(result).toEqual(existingTransaction);
      expect(mockPrismaService.transaction.delete).toHaveBeenCalled();
    });
  });

  describe('addAttachment', () => {
    const userId = 'user-1';
    const txId = 'tx-1';
    const pdfMagic = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x0a]);

    const baseFile = {
      buffer: pdfMagic,
      size: pdfMagic.length,
      mimetype: 'application/pdf',
      originalname: 'doc.pdf',
    };

    beforeEach(() => {
      mockPrismaService.transaction.findFirst.mockResolvedValue({
        id: txId,
        userId,
        type: 'EXPENSE',
        amount: new Decimal(10),
        category: { id: 'c1', type: 'EXPENSE', userId },
        _count: { attachments: 0 },
      });
      mockPrismaService.transactionAttachment.create.mockResolvedValue({
        id: 'att-1',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        fileSize: baseFile.size,
        createdAt: new Date(),
      });
    });

    it('rejeita ficheiro vazio', async () => {
      await expect(
        service.addAttachment(userId, txId, {
          ...baseFile,
          buffer: Buffer.alloc(0),
          size: 0,
        } as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita ficheiro acima do limite', async () => {
      await expect(
        service.addAttachment(userId, txId, {
          ...baseFile,
          size: ATTACHMENT_MAX_FILE_BYTES + 1,
        } as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita MIME não permitido', async () => {
      await expect(
        service.addAttachment(userId, txId, {
          ...baseFile,
          buffer: Buffer.from('ZIP'),
          mimetype: 'application/zip',
        } as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it('aceita PDF e persiste anexo', async () => {
      const r = await service.addAttachment(userId, txId, baseFile as Express.Multer.File);
      expect(r.id).toBe('att-1');
      expect(mockAttachmentScanner.scanOrThrow).toHaveBeenCalled();
      expect(mockPrismaService.transactionAttachment.create).toHaveBeenCalled();
    });
  });
});
