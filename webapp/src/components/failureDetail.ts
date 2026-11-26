import { ApiError } from '../apiClient';

/**
 * Короткая причина сбоя для отчёта наверх: статус сервера или текст ошибки.
 * Без токенов и тел ответа. Общая для формы записи (`bookingFailure.ts`) и
 * страницы после оплаты (`booking/bookingLoadError.ts`): обе зависят от этого
 * листа, а не друг от друга.
 */
export function failureDetail(err: unknown): string {
  return err instanceof ApiError ? `HTTP ${err.status}` : err instanceof Error ? err.message : String(err);
}
