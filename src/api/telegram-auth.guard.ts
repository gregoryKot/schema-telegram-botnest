import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

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

    const entries = initData.split('&').map((seg) => {
      const eq = seg.indexOf('=');
      return [seg.slice(0, eq), decodeURIComponent(seg.slice(eq + 1))] as [string, string];
    });
    const hash = entries.find(([k]) => k === 'hash')?.[1];
    if (!hash) throw new UnauthorizedException('Missing hash');

    const dataCheckString = entries
      .filter(([k]) => k !== 'hash' && k !== 'signature')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computed !== hash) {
      this.logger.warn(`HMAC mismatch.\nhash=${hash}\ncomputed=${computed}\ndataCheckString=\n${dataCheckString}`);
      throw new UnauthorizedException('Invalid initData');
    }

    const userStr = entries.find(([k]) => k === 'user')?.[1];
    if (!userStr) throw new UnauthorizedException('Missing user');
    req.telegramUserId = JSON.parse(userStr).id as number;

    return true;
  }
}
