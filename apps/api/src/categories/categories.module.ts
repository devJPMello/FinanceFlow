import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { categorySchema, CategoryInput, ruleSchema, RuleInput } from '@financeflow/shared';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.module';

export function ruleMatches(rule: { pattern: string; matchType: string }, description: string) {
  if (rule.matchType === 'REGEX') {
    try { return new RegExp(rule.pattern, 'i').test(description); } catch { return false; }
  }
  return description.toLowerCase().includes(rule.pattern.toLowerCase());
}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.category.findMany({ where: { userId }, orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
  }
  create(userId: string, dto: CategoryInput) {
    return this.prisma.category.create({ data: { ...dto, userId } });
  }
  async update(userId: string, id: string, dto: CategoryInput) {
    await this.own(userId, id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }
  async remove(userId: string, id: string) {
    await this.own(userId, id);
    await this.prisma.category.delete({ where: { id } });
  }
  listRules(userId: string) {
    return this.prisma.categoryRule.findMany({ where: { userId }, orderBy: [{ priority: 'desc' }, { pattern: 'asc' }], include: { category: true } });
  }
  async createRule(userId: string, dto: RuleInput) {
    await this.own(userId, dto.categoryId);
    if (dto.matchType === 'REGEX') {
      try { new RegExp(dto.pattern); } catch { throw new BadRequestException('Expressão regular inválida'); }
    }
    return this.prisma.categoryRule.create({ data: { ...dto, userId } });
  }
  async removeRule(userId: string, id: string) {
    await this.prisma.categoryRule.deleteMany({ where: { id, userId } });
  }
  /** Aplica as regras às transações ainda sem categoria (respeitando receita/despesa). */
  async applyRules(userId: string) {
    const rules = await this.prisma.categoryRule.findMany({ where: { userId }, orderBy: { priority: 'desc' }, include: { category: true } });
    if (!rules.length) return { updated: 0 };
    const txs = await this.prisma.transaction.findMany({ where: { userId, categoryId: null, type: { in: ['INCOME', 'EXPENSE'] } }, select: { id: true, description: true, type: true } });
    const byCategory = new Map<string, string[]>();
    for (const t of txs) {
      const rule = rules.find((r) => r.category.kind === t.type && ruleMatches(r, t.description));
      if (rule) byCategory.set(rule.categoryId, [...(byCategory.get(rule.categoryId) ?? []), t.id]);
    }
    let updated = 0;
    for (const [categoryId, ids] of byCategory) {
      updated += (await this.prisma.transaction.updateMany({ where: { userId, id: { in: ids } }, data: { categoryId } })).count;
    }
    return { updated };
  }

  private async own(userId: string, id: string) {
    if (!(await this.prisma.category.findFirst({ where: { id, userId } }))) throw new NotFoundException();
  }
}

@ApiTags('categories')
@ApiBearerAuth()
@Controller()
export class CategoriesController {
  constructor(private svc: CategoriesService) {}

  @Get('categories') list(@CurrentUser() u: string) { return this.svc.list(u); }
  @Post('categories') create(@CurrentUser() u: string, @Body(new ZodPipe(categorySchema)) d: CategoryInput) { return this.svc.create(u, d); }
  @Put('categories/:id') update(@CurrentUser() u: string, @Param('id') id: string, @Body(new ZodPipe(categorySchema)) d: CategoryInput) { return this.svc.update(u, id, d); }
  @Delete('categories/:id') remove(@CurrentUser() u: string, @Param('id') id: string) { return this.svc.remove(u, id); }

  @Get('category-rules') rules(@CurrentUser() u: string) { return this.svc.listRules(u); }
  @Post('category-rules') createRule(@CurrentUser() u: string, @Body(new ZodPipe(ruleSchema)) d: RuleInput) { return this.svc.createRule(u, d); }
  @Post('category-rules/apply') @HttpCode(200) apply(@CurrentUser() u: string) { return this.svc.applyRules(u); }
  @Delete('category-rules/:id') removeRule(@CurrentUser() u: string, @Param('id') id: string) { return this.svc.removeRule(u, id); }
}

@Module({ controllers: [CategoriesController], providers: [CategoriesService], exports: [CategoriesService] })
export class CategoriesModule {}
