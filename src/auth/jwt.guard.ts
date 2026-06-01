import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

export interface WebUser {
  userId: BigInt;
}

// Validates JWT Bearer token issued by AuthService.
// Sets req.webUser = { userId } on success.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['authorization'] as string | undefined;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing Bearer token');

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
    const req = context.switchToHttp().getRequest();
    const header = req.headers['authorization'] as string | undefined;
    if (header?.startsWith('Bearer ')) {
      try {
        const { userId } = this.auth.verifyAccessToken(header.slice(7));
        req.webUser = { userId };
      } catch { /* ignore — treat as anonymous */ }
    }
    // Also support ?link_token= query param for OAuth redirects where
    // we can't set Authorization header (browser top-level navigation).
    const linkToken = req.query?.link_token as string | undefined;
    if (!req.webUser && linkToken) {
      try {
        const { userId } = this.auth.verifyLinkToken(linkToken);
        req.webUser = { userId };
      } catch { /* ignore */ }
    }
    return true;
  }
}
