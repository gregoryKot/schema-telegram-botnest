// Тело Telegram- и MAX-путей TelegramAuthGuard, вынесенное из guard'а, чтобы тот
// остался под потолком файл-храповика. Поведение телеграмного пути — то же,
// что до выноса (покрыто telegram-auth.guard.spec.ts).
import {
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { MaxNotConfiguredError } from '../auth/max-init-data';
import { MaxProvider } from '../auth/providers/max.provider';
import { SecurityLogService } from '../auth/security-log.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { rejectInitData } from './initdata-alert';
import { reportAuthSuccess } from './auth-success.report';
import {
  readTelegramUser,
  verifyTelegramInitDataSignature,
  type TelegramInitDataUser,
} from '../auth/telegram-init-data';

export async function applyTelegramInitData(
  req: Request,
  config: ConfigService,
  authService: AuthService,
  securityLog: SecurityLogService,
  logger: Logger,
  analytics: AnalyticsService,
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
  let params: URLSearchParams;
  if (skipAuth) {
    logger.warn('SKIP_AUTH=true (DEV ONLY) — validation skipped');
    params = new URLSearchParams(initData);
  } else {
    try {
      ({ params } = verifyTelegramInitDataSignature(initData, botToken));
    } catch (err) {
      rejectInitData(err, req.ip, logger, securityLog);
    }
  }

  // Отсутствие user — отдельный ответ; сам разбор (JSON, безопасное целое > 0)
  // живёт в общем верификаторе, второй реализации здесь нет.
  if (!params.get('user')) throw new UnauthorizedException('Missing user');
  let user: TelegramInitDataUser;
  try {
    user = readTelegramUser(params);
  } catch {
    throw new UnauthorizedException('Invalid user data');
  }
  const rawTelegramId = user.id;
  const firstName = user.first_name;

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
  reportAuthSuccess(canonicalId, 'telegram', {
    track: (meta) => void analytics.track(null, 'auth_success', meta),
  });
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
  analytics: AnalyticsService,
): Promise<void> {
  const initData = req.headers['x-max-init-data'] as string;
  let identity: { providerId: string; displayName?: string };
  try {
    identity = maxProvider.verifyInitData(initData);
  } catch (err) {
    // Нет токена — наша конфигурация, а не подделка подписи: в rejectInitData
    // отдавать нельзя, иначе админ получит ложный алерт (см. MaxNotConfiguredError).
    if (err instanceof MaxNotConfiguredError) {
      logger.error('вход из MAX недоступен: не задан MAX_BOT_TOKEN');
      throw new ServiceUnavailableException('MAX login is not configured');
    }
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
  reportAuthSuccess(canonicalId, 'max', {
    track: (meta) => void analytics.track(null, 'auth_success', meta),
  });
}
