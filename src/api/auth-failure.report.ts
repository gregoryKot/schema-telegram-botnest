// Немая ветка отказа входа получает голос (инцидент 2026-08-08).
//
// Что случилось. Мини-апп в Telegram считал себя открытым в MAX и слал
// `x-max-init-data: ` — заголовок есть, значение пустое. В guard пустая
// строка falsy, поэтому запрос проваливался мимо обоих путей подписи в
// финальное `throw new UnauthorizedException('Missing authentication')` —
// ветку без единой строчки лога, счётчика и алерта. Вход был сломан у всех
// пользователей Telegram, а на сервере это выглядело как обычный шум
// неавторизованных запросов. Никто не узнал, пока не написал живой человек.
//
// Что здесь. Пустая подпись отделена от «просто неавторизован»: пустая
// строка в заголовке подписи означает, что мини-приложение ОТКРЫТО в
// мессенджере, но подписи у него нет — это всегда баг клиента, нормой не
// бывает. За такое админ получает DM (с троттлингом, чтобы шквал не заглушил
// чат) и событие в аналитике, которое видно в /stats.
//
// Обычный неавторизованный запрос (заголовков нет вовсе — боты, сканеры,
// протухшая вкладка) не пишется никуда: это фон интернета, и запись каждого
// такого запроса в БД была бы вектором на её раздувание.
import { Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AlertThrottle } from '../utils/alert-throttle';
import { SecurityLogService } from '../auth/security-log.service';

export type EmptySignatureHost = 'telegram' | 'max';

const HEADER_BY_HOST: Record<EmptySignatureHost, string> = {
  telegram: 'x-telegram-init-data',
  max: 'x-max-init-data',
};

/** Один DM в 15 минут на площадку: авария — это поток, а не единичный запрос. */
const ALERT_THROTTLE = new AlertThrottle(15 * 60_000);
/** Событий в БД — не больше одного на IP в 5 минут: экран шлёт полтора десятка
 *  запросов подряд, и без этого одна авария писала бы тысячи строк. */
const EVENT_THROTTLE = new AlertThrottle(5 * 60_000);

/**
 * Заголовок подписи пришёл, но пустой — какой площадки. `null`, если
 * заголовков подписи нет вовсе (обычный неавторизованный запрос).
 */
export function emptySignatureHost(
  headers: Request['headers'],
): EmptySignatureHost | null {
  for (const host of Object.keys(HEADER_BY_HOST) as EmptySignatureHost[]) {
    const value = headers[HEADER_BY_HOST[host]];
    if (typeof value === 'string' && value.trim() === '') return host;
  }
  return null;
}

export interface AuthFailureSinks {
  logger: Logger;
  securityLog: SecurityLogService;
  /** Запись события. Отвязана от AnalyticsService, чтобы модуль тестировался
   *  без Nest-обвязки; ошибки внутри глотает сам вызывающий. */
  track: (meta: {
    reason: 'empty_signature';
    host: EmptySignatureHost;
  }) => void;
  now?: number;
}

/**
 * Вызывается ПЕРЕД тем, как guard бросит 401 «нет аутентификации».
 * Возвращает true, если отказ был из-за пустой подписи (то есть аварийный).
 */
export function reportAuthFailure(
  headers: Request['headers'],
  ip: string | undefined,
  sinks: AuthFailureSinks,
): boolean {
  const host = emptySignatureHost(headers);
  if (!host) return false;

  const now = sinks.now ?? Date.now();
  const event = EVENT_THROTTLE.take(`${host}|${ip ?? 'no-ip'}`, now);
  if (event.allow) sinks.track({ reason: 'empty_signature', host });

  const alert = ALERT_THROTTLE.take(host, now);
  if (alert.allow) {
    // Через SecurityLogService, а не своим каналом: у него уже есть DM админу
    // с почтовым фолбэком и вырезание секретов. Значений в data нет — только
    // площадка и счётчик проглоченных случаев.
    sinks.securityLog.log('empty_signature', {
      host,
      suppressedSinceLastAlert: alert.suppressed,
      hint: 'мини-апп открыт в мессенджере, но подписи нет — сломан клиент',
    });
  } else {
    sinks.logger.warn(`empty ${host} signature (алерт подавлен троттлингом)`);
  }
  return true;
}
