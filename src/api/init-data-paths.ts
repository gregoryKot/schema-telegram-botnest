// Тело Telegram- и MAX-путей TelegramAuthGuard, вынесенное в отдельный файл,
// чтобы сам guard остался под потолком файл-храповика (scripts/
// file-size-baseline.json, было 105 строк). Поведение телеграмного пути —
// байт-в-байт то же, что и до выноса (покрыто telegram-auth.guard.spec.ts).
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validate } from '@tma.js/init-data-node';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { MaxProvider } from '../auth/providers/max.provider';
import { SecurityLogService } from '../auth/security-log.service';
import { rejectInitData } from './initdata-alert';

export async function applyTelegramInitData(
  req: Request,
  config: ConfigService,
  authService: AuthService,
  securityLog: SecurityLogService,
  logger: Logger,
): Promise<void> {
  const initData = req.headers['x-telegram-init-data'] as string;
  const botToken = config.get<string>('BOT_TOKEN')?.trim();
  if (!botToken) throw new UnauthorizedException('BOT_TOKEN not configured');

  // SKIP_AUTH was a dev-only escape hatch. Hard-disable in production
  // regardless of env value — otherwise a misconfig/leaked secret = full
  // takeover of every Telegram user by passing crafted x-telegram-init-data.
  const skipAuth =
    process.env.NODE_ENV !== 'production' &&
    config.get<string>('SKIP_AUTH') === 'true';
  if (skipAuth) {
    logger.warn('SKIP_AUTH=true (DEV ONLY) — validation skipped');
  } else {
    try {
      validate(initData, botToken, { expiresIn: 3600 });
    } catch (err) {
      rejectInitData(err, req.ip, logger, securityLog);
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
  const canonicalId = await authService.findOrCreateUserByProvider(
    'telegram',
    String(rawTelegramId),
    firstName,
  );
  req.telegramUserId = Number(canonicalId);
  req.telegramFirstName = firstName;
  // Also expose BigInt-safe ref for controllers that need it
  req.webUser = { userId: canonicalId };
}

// MAX mini-app initData path — same shape as Telegram's, but signature
// verification is delegated to MaxProvider (src/auth/max-init-data.ts
// implements MAX's own validation algorithm and its own bot token).
export async function applyMaxInitData(
  req: Request,
  maxProvider: MaxProvider,
  authService: AuthService,
  securityLog: SecurityLogService,
  logger: Logger,
): Promise<void> {
  const initData = req.headers['x-max-init-data'] as string;
  let identity: { providerId: string; displayName?: string };
  try {
    identity = maxProvider.verifyInitData(initData);
  } catch (err) {
    rejectInitData(err, req.ip, logger, securityLog);
  }

  const canonicalId = await authService.findOrCreateUserByProvider(
    'max',
    identity.providerId,
    identity.displayName,
  );
  req.telegramUserId = Number(canonicalId);
  req.telegramFirstName = identity.displayName;
  req.webUser = { userId: canonicalId };
}
