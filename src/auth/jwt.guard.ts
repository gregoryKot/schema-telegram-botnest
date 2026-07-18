import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request } from 'express';

export interface WebUser {
  userId: bigint;
}

// Validates JWT Bearer token issued by AuthService.
// Sets req.webUser = { userId } on success.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer '))
      throw new UnauthorizedException('Missing Bearer token');

    const token = header.slice(7);
    const { userId } = this.auth.verifyAccessToken(token);
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
    // Link-token для OAuth-редиректов (top-level навигация — Authorization
    // header поставить нельзя). Основной канал — httpOnly-cookie `link_token`
    // (ставится эндпоинтом /link-token); query-параметр оставлен как legacy
    // fallback для закэшированных клиентов и будет удалён (аудит 2026-07,
    // S-4: токены в URL утекают в логи прокси и историю браузера).
    const cookies = req.cookies as Record<string, string | undefined>;
    const linkToken = (cookies?.['link_token'] ?? req.query?.link_token) as
      | string
      | undefined;
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
