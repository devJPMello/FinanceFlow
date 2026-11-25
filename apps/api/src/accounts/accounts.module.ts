import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { accountSchema, AccountInput } from '@financeflow/shared';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const accounts = await this.prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    const sums = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { userId },
      _sum: { amount: true },
    });
    return accounts.map((a) => {
      let balance = Number(a.initialBalance);
      for (const s of sums.filter((x) => x.accountId === a.id)) {
        const v = Number(s._sum.amount ?? 0);
        balance += s.type === 'INCOME' ? v : -v;
      }
      return { ...a, initialBalance: Number(a.initialBalance), balance };
    });
  }

  create(userId: string, dto: AccountInput) {
    return this.prisma.account.create({ data: { ...dto, userId } });
  }

  async update(userId: string, id: string, dto: AccountInput) {
    await this.own(userId, id);
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.own(userId, id);
    await this.prisma.account.delete({ where: { id } });
  }

  private async own(userId: string, id: string) {
    const a = await this.prisma.account.findFirst({ where: { id, userId } });
    if (!a) throw new NotFoundException();
  }
}

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(private svc: AccountsService) {}

  @Get() list(@CurrentUser() u: string) { return this.svc.list(u); }

  @Post() create(@CurrentUser() u: string, @Body(new ZodPipe(accountSchema)) dto: AccountInput) {
    return this.svc.create(u, dto);
  }

  @Put(':id') update(@CurrentUser() u: string, @Param('id') id: string, @Body(new ZodPipe(accountSchema)) dto: AccountInput) {
    return this.svc.update(u, id, dto);
  }

  @Delete(':id') remove(@CurrentUser() u: string, @Param('id') id: string) { return this.svc.remove(u, id); }
}

@Module({ controllers: [AccountsController], providers: [AccountsService], exports: [AccountsService] })
export class AccountsModule {}
