import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { AuthService } from './auth.service';

/**
 * Nota: em @clerk/backend v3+, verifyToken exportado usa withLegacyReturn:
 * em caso de erro lança exceção; em sucesso devolve o JwtPayload diretamente
 * (não um objeto { data, errors }).
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization as string | undefined;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }
    const token = header.slice(7);
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new UnauthorizedException('CLERK_SECRET_KEY não configurada');
    }

    let payload: { sub?: string };
    try {
      payload = (await verifyToken(token, {
        secretKey,
      })) as { sub?: string };
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    const clerkUserId = payload?.sub;
    if (!clerkUserId) {
      throw new UnauthorizedException('Token sem identificador');
    }

    req.user = await this.authService.ensureClerkUser(clerkUserId);
    return true;
  }
}
