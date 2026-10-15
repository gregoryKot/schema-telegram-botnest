// Исход кнопки «Это я, объединить» — событиями аналитики (правило №8).
//
// Пишет сервер: подтверждение произошло в боте, а сайт узнаёт об исходе только
// опросом и поля `merged` не видит, отправить событие ему нечем.
import { BadRequestException } from '@nestjs/common';
import type { AnalyticsService } from '../analytics/analytics.service';
import type { AccountLinkFailReason } from '../analytics/analytics.constants';

/**
 * Повторный тап того же человека (`repeat`) событием не считается: слияние
 * уже посчитано первым тапом, и «подтвердили» в /stats иначе задвоилось бы.
 */
export function trackLinkConfirmed(
  analytics: Pick<AnalyticsService, 'track'>,
  userId: bigint,
  res: { merged: boolean; repeat?: true },
): void {
  if (res.repeat) return;
  void analytics.track(userId, 'account_link_confirmed', {
    host: 'web',
    merged: res.merged,
  });
}

/**
 * Настоящий провал в отчёт: до этого карточка «Не получилось» рисовалась
 * человеку, а владелец о ней не узнавал. Без userId — причина могла быть и в
 * том, что аккаунт определить не удалось.
 */
export function trackLinkFailed(
  analytics: Pick<AnalyticsService, 'track'>,
  err: unknown,
): void {
  const expired =
    err instanceof BadRequestException &&
    /не найден или истёк/.test(err.message);
  const reason: AccountLinkFailReason = expired ? 'expired' : 'error';
  void analytics.track(null, 'account_link_failed', { host: 'web', reason });
}
