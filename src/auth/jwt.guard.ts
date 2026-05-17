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
