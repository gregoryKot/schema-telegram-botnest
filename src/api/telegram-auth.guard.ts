import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validate } from '@telegram-apps/init-data-node';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const initData = req.headers['x-telegram-init-data'] as string;
    if (!initData) throw new UnauthorizedException('Missing initData');

    const botToken = this.config.get<string>('BOT_TOKEN')?.trim();
    if (!botToken) throw new UnauthorizedException('BOT_TOKEN not configured');

    const skipAuth = this.config.get<string>('SKIP_AUTH') === 'true';
    if (skipAuth) {
      this.logger.warn('SKIP_AUTH=true — validation skipped');
    } else {
      try {
        validate(initData, botToken, { expiresIn: 86400 }); // 24h — Telegram initData lifetime
      } catch (err) {
        this.logger.warn(`initData invalid: ${(err as Error).message}`);
        throw new UnauthorizedException('Invalid initData');
      }
    }

    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) throw new UnauthorizedException('Missing user');
    try {
      const user = JSON.parse(userStr);
      if (typeof user.id !== 'number') throw new Error('Invalid user.id');
      req.telegramUserId = user.id;
    } catch {
      throw new UnauthorizedException('Invalid user data');
    }

    return true;
  }
}
