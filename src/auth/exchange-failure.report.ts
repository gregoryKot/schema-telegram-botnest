// Отказ обмена подписи мессенджера на сессию — событие messenger_launch_failed
// для блока «Вход в мессенджере» в /stats (находка 2026-11-08).
//
// Зачем. Сайт внутри Telegram и MAX ходит с `Authorization: Bearer`, а подпись
// мессенджера меняет на сессию в POST /api/auth/telegram/webapp и
// /api/auth/max/webapp. Удачный обмен пишет messenger_launch, а отказ (подпись
// устарела или не сошлась) уходил только в журнал безопасности через
// rejectInitData. Блок отчёта при этом считал путь мини-аппа — заголовки
// подписи в TelegramAuthGuard, которых сайт не шлёт, — и сломанный вход сайта
// в мессенджере не видел вовсе. Пара messenger_launch / messenger_launch_failed
// и есть «обмен прошёл / не прошёл».
//
// userId = null — тот же приём, что у messenger_launch: подписи не поверили,
// личность неизвестна, а /stats считает только строки без userId и с meta.
// Подделка через POST /api/event несёт userId, а meta у неё отрезает
// sanitizeMeta (SERVER_META_EVENTS) — в отчёт она не попадает.
//
// meta — площадка, платформа из списка и причина, больше ничего: ни текста
// ошибки, ни IP, ни initData (секреты и сырые данные в аналитику не пишем).
// Чистая функция + sinks, без Nest-обвязки — как src/api/auth-failure.report.ts.
import { AlertThrottle } from '../utils/alert-throttle';
import {
  classifyInitDataFailure,
  type InitDataFailureKind,
} from '../api/initdata-alert';
import {
  normalizeLaunchPlatform,
  type LaunchHost,
  type LaunchPlatform,
} from '../analytics/launch-platforms.constants';
import type { AnalyticsService } from '../analytics/analytics.service';

/** Строк в БД — не больше одной на площадку и IP за 5 минут (то же окно, что
 *  EVENT_THROTTLE в auth-failure.report.ts): окно мессенджера повторяет обмен,
 *  а считать нужно неудачную попытку входа, а не каждый повтор. */
const EVENT_THROTTLE = new AlertThrottle(5 * 60_000);

// type, а не interface: meta уходит в track() как Record<string, unknown>.
export type ExchangeFailureMeta = {
  host: LaunchHost;
  platform: LaunchPlatform;
  reason: InitDataFailureKind;
};

export interface ExchangeFailureSinks {
  /** Запись события; track() аналитики сам не бросает. */
  track: (meta: ExchangeFailureMeta) => void;
  now?: number;
}

/**
 * Вызывается в catch ручки обмена ДО rejectInitData (тот всегда бросает 401).
 * Отказ нашей конфигурации (нет токена бота) сюда не передаётся: это не
 * клиент не смог войти, а мы не настроили вход.
 */
export function reportExchangeFailure(
  err: unknown,
  host: LaunchHost,
  rawPlatform: unknown,
  ip: string | undefined,
  sinks: ExchangeFailureSinks,
): void {
  const now = sinks.now ?? Date.now();
  if (!EVENT_THROTTLE.take(`${host}|${ip ?? 'no-ip'}`, now).allow) return;
  sinks.track({
    host,
    platform: normalizeLaunchPlatform(rawPlatform),
    reason: classifyInitDataFailure(err),
  });
}

/** Сток ручек обмена: строка messenger_launch_failed с userId = null. Имя
 *  события живёт только здесь — контроллеры его не повторяют. */
export function failureSinks(
  analytics: Pick<AnalyticsService, 'track'>,
): ExchangeFailureSinks {
  return {
    track: (meta) =>
      void analytics.track(null, 'messenger_launch_failed', meta),
  };
}
