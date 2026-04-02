import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const mockGetUser = jest.fn();

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({
    users: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  })),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn((k: string) =>
      k === 'CLERK_SECRET_KEY' ? 'sk_test_mock' : undefined,
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('ensureClerkUser', () => {
    it('retorna utilizador existente por clerkId', async () => {
      const row = { id: 'u1', email: 'a@b.com', name: 'A' };
      mockPrisma.user.findUnique.mockResolvedValueOnce(row);

      const result = await service.ensureClerkUser('user_clerk_1');

      expect(result).toEqual(row);
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('cria utilizador quando não existe', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockGetUser.mockResolvedValue({
        primaryEmailAddressId: 'e1',
        emailAddresses: [{ id: 'e1', emailAddress: 'new@b.com' }],
        firstName: 'N',
        lastName: 'M',
        username: null,
      });
      const created = { id: 'u2', email: 'new@b.com', name: 'N M' };
      mockPrisma.user.create.mockResolvedValue(created);

      const result = await service.ensureClerkUser('user_clerk_2');

      expect(result).toEqual(created);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('lança se Clerk não devolver email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockGetUser.mockResolvedValue({
        primaryEmailAddressId: null,
        emailAddresses: [],
        firstName: null,
        lastName: null,
        username: null,
      });

      await expect(service.ensureClerkUser('user_x')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
