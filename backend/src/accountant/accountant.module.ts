import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AccountantPackageService } from './accountant-package.service';
import { AccountantController } from './accountant.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AccountantController],
  providers: [AccountantPackageService],
})
export class AccountantModule {}
