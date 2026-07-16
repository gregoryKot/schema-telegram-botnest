import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validate } from '@tma.js/init-data-node';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { Request } from 'express';

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
    const req = context.switchToHttp().getRequest<Request>();

    // ── Path 1: JWT Bearer (web app) ─────────────────────────────────────────
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { userId } = this.authService.verifyAccessToken(token);
      // userId is a BigInt — convert to number for backward compat with controllers
      req.telegramUserId = Number(userId);
      req.webUser = { userId };
      // Ensure user row exists (web-only users may have never touched the bot)
      await this.prisma.user.upsert({
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
    const skipAuth =
      process.env.NODE_ENV !== 'production' &&
      this.config.get<string>('SKIP_AUTH') === 'true';
    if (skipAuth) {
      this.logger.warn('SKIP_AUTH=true (DEV ONLY) — validation skipped');
    } else {
      try {
        validate(initData, botToken, { expiresIn: 3600 });
      } catch (err) {
        const reason = (err as Error).message;
        this.logger.warn(`initData invalid: ${reason}`);
        // Loud alert: signature failure on initData is either a real attack
        // (someone trying to forge a Telegram identity) or a bot-token rotation
        // we forgot to roll out. Either way, admin should see it.
        fetch(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: process.env.ADMIN_ID,
              text: `🚨 suspicious_initdata: ${reason} (ip: ${req.ip ?? '?'})`,
            }),
            signal: AbortSignal.timeout(5_000),
          },
        ).catch(() => null);
        throw new UnauthorizedException('Invalid initData');
      }
    }

    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) throw new UnauthorizedException('Missing user');
    let rawTelegramId: number;
    let firstName: string | undefined;
    try {
      const user = JSON.parse(userStr) as {
        id?: unknown;
        first_name?: unknown;
      };
      if (typeof user.id !== 'number') throw new Error('Invalid user.id');
      rawTelegramId = user.id;
      firstName =
        typeof user.first_name === 'string' ? user.first_name : undefined;
    } catch {
      throw new UnauthorizedException('Invalid user data');
    }

    // Resolve canonical userId via AuthProvider so that merged accounts
    // (Telegram merged → Google) still land on the correct userId instead
    // of creating a new empty User with the raw Telegram ID.
    const canonicalId = await this.authService.findOrCreateUserByProvider(
      'telegram',
      String(rawTelegramId),
      firstName,
    );
    req.telegramUserId = Number(canonicalId);
    req.telegramFirstName = firstName;
    // Also expose BigInt-safe ref for controllers that need it
    req.webUser = { userId: canonicalId };

    return true;
  }
}
