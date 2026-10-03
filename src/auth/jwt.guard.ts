import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Request } from 'express';

export interface WebUser {
  userId: bigint;
}

// Validates JWT Bearer token issued by AuthService.
// Sets req.webUser = { userId } on success.
// Аккаунт обязан быть жив (A5, аудит 2026-10): токен живёт 15 минут — дольше
// удаления/слияния аккаунта. Как в TelegramAuthGuard, но без upsert.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer '))
      throw new UnauthorizedException('Missing Bearer token');

    const token = header.slice(7);
    const { userId } = this.auth.verifyAccessToken(token);
    const a = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true },
    });
    if (!a || a.deletedAt) throw new UnauthorizedException('Account gone');
    req.webUser = { userId };
    return true;
  }
}

// Same as JwtAuthGuard but doesn't throw if token is missing/invalid.
// Used by endpoints that behave differently for anonymous vs authed users
// (e.g. /api/auth/google: anonymous → sign-up, authed → link to existing).
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    if (header?.startsWith('Bearer ')) {
      try {
        const { userId } = this.auth.verifyAccessToken(header.slice(7));
        req.webUser = { userId };
      } catch {
        /* ignore — treat as anonymous */
      }
    }
    // Link-token для OAuth-редиректов — ТОЛЬКО httpOnly-кука `link_token`
    // (/link-token). `?link_token=` убран (A1, аудит 2026-10): login-CSRF —
    // злоумышленник выпускает токен СВОЕГО аккаунта и шлёт жертву на
    // /api/auth/google?link_token=…, чужой Google привязывается к нему.
    // Куку чужому браузеру не поставить, URL — можно.
    const cookies = req.cookies as Record<string, string | undefined>;
    const linkToken = cookies?.['link_token'];
    if (!req.webUser && linkToken) {
      try {
        const { userId } = this.auth.verifyLinkToken(linkToken);
        req.webUser = { userId };
      } catch {
        /* ignore */
      }
    }
    return true;
  }
}
