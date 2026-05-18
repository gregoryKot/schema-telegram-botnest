import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validate } from '@telegram-apps/init-data-node';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

// Unified guard: accepts Telegram initData (mini-app / bot) OR JWT Bearer (web app).
// Sets req.telegramUserId (number) which all existing controllers rely on.
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // ── Path 1: JWT Bearer (web app) ─────────────────────────────────────────
    const authHeader = req.headers['authorization'] as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { userId } = this.authService.verifyAccessToken(token);
      // userId is a BigInt — convert to number for backward compat with controllers
      req.telegramUserId = Number(userId);
      req.webUser = { userId };
      // Ensure user row exists (web-only users may have never touched the bot)
      await (this.prisma.user as any).upsert({
        where: { id: userId },
        update: {},
        create: { id: userId },
      });
      return true;
    }

    // ── Path 2: Telegram initData (mini-app) ─────────────────────────────────
    const initData = req.headers['x-telegram-init-data'] as string;
    if (!initData) throw new UnauthorizedException('Missing authentication');

    const botToken = this.config.get<string>('BOT_TOKEN')?.trim();
    if (!botToken) throw new UnauthorizedException('BOT_TOKEN not configured');

    // SKIP_AUTH was a dev-only escape hatch. Hard-disable in production
    // regardless of env value — otherwise a misconfig/leaked secret = full
    // takeover of every Telegram user by passing crafted x-telegram-init-data.
    const skipAuth = process.env.NODE_ENV !== 'production'
      && this.config.get<string>('SKIP_AUTH') === 'true';
    if (skipAuth) {
      this.logger.warn('SKIP_AUTH=true (DEV ONLY) — validation skipped');
    } else {
      try {
        validate(initData, botToken, { expiresIn: 86400 });
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
      req.telegramFirstName = typeof user.first_name === 'string' ? user.first_name : undefined;
    } catch {
      throw new UnauthorizedException('Invalid user data');
    }

    await (this.prisma.user as any).upsert({
      where: { id: BigInt(req.telegramUserId) },
      update: req.telegramFirstName ? { firstName: req.telegramFirstName } : {},
      create: { id: BigInt(req.telegramUserId), firstName: req.telegramFirstName },
    });

    return true;
  }
}
