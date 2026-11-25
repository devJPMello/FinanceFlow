import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { ChangePasswordInput, LoginInput, ProfileInput, RegisterInput } from '@financeflow/shared';
import { removeUserFolder } from '../attachments/storage';
import { PrismaService } from '../prisma/prisma.module';

const DEFAULT_CATEGORIES: [string, 'INCOME' | 'EXPENSE', string][] = [
  ['Alimentação', 'EXPENSE', '#f97316'],
  ['Moradia', 'EXPENSE', '#6366f1'],
  ['Transporte', 'EXPENSE', '#0ea5e9'],
  ['Saúde', 'EXPENSE', '#ef4444'],
  ['Lazer', 'EXPENSE', '#a855f7'],
  ['Educação', 'EXPENSE', '#14b8a6'],
  ['Compras', 'EXPENSE', '#eab308'],
  ['Outros', 'EXPENSE', '#64748b'],
  ['Salário', 'INCOME', '#22c55e'],
  ['Rendimentos', 'INCOME', '#10b981'],
  ['Outras receitas', 'INCOME', '#84cc16'],
];

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(dto: RegisterInput) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('E-mail já cadastrado');
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        categories: { create: DEFAULT_CATEGORIES.map(([name, kind, color]) => ({ name, kind, color })) },
        accounts: { create: { name: 'Conta principal', type: 'CHECKING' } },
      },
    });
    return this.issue(user);
  }

  async login(dto: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.issue(user);
  }

  async refresh(refreshToken: string) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha(refreshToken ?? '') } });
    if (!row || row.expiresAt < new Date()) throw new UnauthorizedException();
    await this.prisma.refreshToken.delete({ where: { id: row.id } }); // rotação do refresh token
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: row.userId } });
    return this.issue(user);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash: sha(refreshToken ?? '') } });
  }

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: u.id, name: u.name, email: u.email };
  }

  async updateProfile(userId: string, dto: ProfileInput) {
    const u = await this.prisma.user.update({ where: { id: userId }, data: { name: dto.name } });
    return { id: u.id, name: u.name, email: u.email };
  }

  async changePassword(userId: string, dto: ChangePasswordInput) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(dto.currentPassword, u.passwordHash))) throw new BadRequestException('Senha atual incorreta');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) } });
    // encerra as outras sessões
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async deleteAccount(userId: string, password: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!password || !(await bcrypt.compare(password, u.passwordHash))) throw new BadRequestException('Senha incorreta');
    await this.prisma.user.delete({ where: { id: userId } });
    await removeUserFolder(userId);
  }

  private async issue(user: { id: string; name: string; email: string }) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
    );
    const refreshToken = randomBytes(48).toString('hex');
    const days = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha(refreshToken), expiresAt: new Date(Date.now() + days * 86_400_000) },
    });
    return { accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email } };
  }
}
