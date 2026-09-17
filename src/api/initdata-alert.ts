// Классификация отказов initData + защита админского чата от шквала алертов.
//
// Инцидент 2026-07-29: Telegram выдаёт initData ОДИН раз — в момент открытия
// мини-аппа — и не обновляет её, пока webview жив. Свернул приложение, открыл
// через час: та же строка, `auth_date` старше часа, каждый запрос ловит 401.
// Экран мини-аппа шлёт полтора десятка запросов, и каждый уходил админу
// отдельным DM «🚨 suspicious_initdata». Истёкшая сессия — обычный жизненный
// цикл, а не атака: будить ею админа нельзя, и главное — в этом потоке тонет
// настоящая подделка подписи, ради которой алерт и заводился.
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ExpiredError } from '@tma.js/init-data-node';
import { SecurityLogService } from '../auth/security-log.service';
import { AlertThrottle } from '../utils/alert-throttle';

export type InitDataFailureKind = 'expired' | 'suspicious';

/** Код в теле 401 — по нему мини-апп понимает, что сессию надо перевыпустить. */
export const INITDATA_EXPIRED_CODE = 'initdata_expired';

export function classifyInitDataFailure(err: unknown): InitDataFailureKind {
  if (err instanceof ExpiredError) return 'expired';
  // Подстраховка: error-kid-классы теряют instanceof, если пакет продублирован
  // (ESM/CJS-копии в дереве зависимостей) — тогда смотрим на текст ошибки.
  const msg = err instanceof Error ? err.message : String(err);
  return /^init data expired/i.test(msg) ? 'expired' : 'suspicious';
}

// Троттлинг по IP, специфичный для этого гварда (см. src/utils/alert-throttle.ts
// для примитива и общей мотивации).
export const initDataAlerts = new AlertThrottle(10 * 60_000);

/** Всегда бросает 401; различает истёкшую сессию и попытку подделки. */
export function rejectInitData(
  err: unknown,
  ip: string | undefined,
  logger: Logger,
  securityLog: SecurityLogService,
): never {
  const reason = (err as Error).message;
  // Истёкшая initData — не атака, а жизненный цикл мини-аппа (см. шапку файла).
  // Мини-апп чинит это сам: по коду ниже он перевыпускает сессию.
  if (classifyInitDataFailure(err) === 'expired') {
    throw new UnauthorizedException({
      code: INITDATA_EXPIRED_CODE,
      message: 'Telegram init data expired',
    });
  }
  logger.warn(`initData invalid: ${reason}`);
  // Подделка подписи — либо реальная атака, либо недокатившаяся ротация
  // BOT_TOKEN; админ обязан это увидеть.
  const { allow, suppressed } = initDataAlerts.take(ip ?? '?');
  if (allow) {
    securityLog.log('suspicious_initdata', {
      reason,
      ip,
      ...(suppressed > 0 ? { suppressed } : {}),
    });
  }
  throw new UnauthorizedException('Invalid initData');
}
