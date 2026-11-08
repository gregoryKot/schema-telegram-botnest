import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertLiveAccess } from './live-access';
import type { Request } from 'express';

export interface WebUser {
  userId: bigint;
}

// Validates JWT Bearer token issued by AuthService.
// Sets req.webUser = { userId } on success.
// Аккаунт и сессия токена обязаны быть живы (A5 аудита 2026-10, хвост S12
// аудита 2026-11) — live-access.ts, общий с TelegramAuthGuard.
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
    const { userId, sid } = this.auth.verifyAccessToken(token);
    await assertLiveAccess(this.prisma, userId, sid);
    req.webUser = { userId };
    return true;
  }
}

// Как JwtAuthGuard, но без 401: нет токена, он битый, аккаунт удалён или
// сессия отозвана — аноним (роуты входа: optional-auth-routes.ts).
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    if (header?.startsWith('Bearer ')) {
      try {
        const { userId, sid } = this.auth.verifyAccessToken(header.slice(7));
        await assertLiveAccess(this.prisma, userId, sid);
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
        req.webUser = { userId, viaLinkToken: true };
      } catch {
        /* ignore */
      }
    }
    return true;
  }
}
