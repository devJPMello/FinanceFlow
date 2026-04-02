import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';

describe('FeatureFlagsController', () => {
  let controller: FeatureFlagsController;
  const prisma = { $executeRawUnsafe: jest.fn() };
  const flags = { isEnabled: jest.fn() };
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeatureFlagsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: FeatureFlagsService, useValue: flags },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FeatureFlagsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('upsertFlag recusa sem header ou segredo incorreto', async () => {
    configGet.mockReturnValue('expected-secret');
    await expect(controller.upsertFlag(undefined, 'k', {})).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.upsertFlag('wrong', 'k', {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('upsertFlag recusa se ADMIN_OPERATIONS_SECRET não estiver definido', async () => {
    configGet.mockReturnValue(undefined);
    await expect(controller.upsertFlag('any', 'k', {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('upsertFlag grava quando o segredo coincide', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'ADMIN_OPERATIONS_SECRET' ? 'admin-key' : undefined,
    );
    prisma.$executeRawUnsafe.mockResolvedValue(undefined);

    await controller.upsertFlag('admin-key', 'my_flag', { enabled: true });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
  });
});
