import { ApiError } from '../apiClient';
import { reportClientError } from '../api';

// Исход неудачной отправки формы записи. Инцидент 2026-09-13: сервер падал на
// каждой попытке, а под формой висело «возможно, время только что заняли.
// Обновите страницу» — текст врал про причину и звал жать снова (человек
// нажал семь раз). Теперь причина различается по ответу сервера:
//   taken     — слот занят/недоступен, выбрать другой поможет (409 или 400);
//   error     — сбой на нашей стороне или сети: повторять бесполезно, заявка
//               НЕ сохранилась, и об этом сообщается наверх (секция booking).
// Исхода «контакт не найден среди клиентов» нет и быть не должно (security#19):
// сервер не подтверждает посторонним, чей это контакт.
export type BookingFailure = 'taken' | 'error';

export function classifyBookingFailure(err: unknown): BookingFailure {
  if (err instanceof ApiError && (err.status === 409 || err.status === 400)) return 'taken';
  return 'error';
}

/** Классифицирует отказ и, если это наш сбой, сообщает о нём наверх. */
export function handleBookingFailure(err: unknown): BookingFailure {
  const kind = classifyBookingFailure(err);
  if (kind === 'error') {
    const detail = err instanceof ApiError ? `HTTP ${err.status}` : err instanceof Error ? err.message : String(err);
    reportClientError({ message: `booking submit failed: ${detail}`, section: 'booking' });
  }
  return kind;
}
