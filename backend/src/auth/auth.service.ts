import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { PrismaService } from '../prisma/prisma.service';
import { UserPayload } from '../common/interfaces/user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Garante um utilizador local alinhado ao Clerk (cria ou associa por email).
   */
  async ensureClerkUser(clerkUserId: string): Promise<UserPayload> {
    const existing = await this.prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, email: true, name: true },
    });
    if (existing) {
      return existing;
    }

    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new UnauthorizedException('CLERK_SECRET_KEY não configurada');
    }

    const client = createClerkClient({ secretKey });
    const cu = await client.users.getUser(clerkUserId);

    const primaryId = cu.primaryEmailAddressId;
    const primary = cu.emailAddresses.find((e) => e.id === primaryId);
    const email = primary?.emailAddress ?? cu.emailAddresses[0]?.emailAddress;
    if (!email) {
      throw new UnauthorizedException('Conta Clerk sem email');
    }

    const name =
      [cu.firstName, cu.lastName].filter(Boolean).join(' ').trim() ||
      cu.username ||
      email.split('@')[0];

    const byEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, clerkId: true },
    });

    if (byEmail) {
      if (byEmail.clerkId && byEmail.clerkId !== clerkUserId) {
        throw new UnauthorizedException('Email já vinculado a outra conta');
      }
      if (!byEmail.clerkId) {
        await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { clerkId: clerkUserId, name },
        });
        return { id: byEmail.id, email: byEmail.email, name };
      }
      return { id: byEmail.id, email: byEmail.email, name: byEmail.name };
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        name,
        clerkId: clerkUserId,
        password: null,
      },
      select: { id: true, email: true, name: true },
    });

    return created;
  }
}
