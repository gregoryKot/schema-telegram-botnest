import { ApiError } from '../../apiClient';
import { reportClientError } from '../../api';
import { POLL_LIMIT_MS } from './paidPageModel';

/** Почему бронь не загрузилась: сервер её не знает (404) или проверить не вышло. */
export type BookingLoadError = 'notFound' | 'failed';

/** Короткая причина для отчёта наверх: статус сервера или текст ошибки (без токенов и тел ответа). */
export function failureDetail(err: unknown): string {
  return err instanceof ApiError ? `HTTP ${err.status}` : err instanceof Error ? err.message : String(err);
}

/** 404 — ссылка не ведёт ни на какую бронь; всё прочее (5xx, 429, сеть, HTML вместо JSON) — сбой. */
export function classifyLoadError(err: unknown): BookingLoadError {
  return err instanceof ApiError && err.status === 404 ? 'notFound' : 'failed';
}

/**
 * Отказ первой загрузки брони: классифицирует и шлёт отчёт наверх (правило
 * №14: экран-тупик без отчёта — невидимая авария). Отчёт один за жизнь
 * страницы (`reported`), чтобы ручные «Обновить» не множили сигналы; токена
 * в сообщении нет.
 */
export function handleLoadFailure(err: unknown, reported: { current: boolean }): BookingLoadError {
  if (!reported.current) {
    reported.current = true;
    reportClientError({ message: `booking paid page: не удалось загрузить бронь по токену: ${failureDetail(err)}`, section: 'booking' });
  }
  return classifyLoadError(err);
}

/** Бронь так и осталась HELD после POLL_LIMIT_MS: вебхук оплаты не дошёл или завис. */
export function reportHeldTimeout(): void {
  reportClientError({
    message: `booking paid page: бронь осталась HELD через ${POLL_LIMIT_MS / 1000} с после возврата с оплаты`,
    section: 'booking',
  });
}
