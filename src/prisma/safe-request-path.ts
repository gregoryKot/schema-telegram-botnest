import { stripUrlSecrets } from '../api/telemetry-url.util';

// Путь запроса для лога, который уходит в ALERT-канал (DM админу + e-mail).
// Аудит 2026-10 (D1): фильтры исключений писали в первый аргумент
// `logger.error` сырой `req.url`, а там живут секреты:
//   • query — `?token=` (email-callback, 2fa), OAuth `?code=&state=`;
//   • сегмент пути — `/api/booking/by-token/:token`, `/api/booking/ics/:token`
//     (capability-токен записи: у кого ссылка, тот управляет бронью).
// `stripUrlSecrets` режет query/fragment, но токен в ПУТИ не видит — его
// маскирует этот хелпер.

/** Сегменты, после которых в пути всегда идёт токен-capability. */
const TOKEN_PRECEDERS = new Set([
  'by-token',
  'ics',
  'cancel',
  'token',
  'confirm',
  'unsubscribe',
]);

/** Длинный сегмент из символов hex/uuid/base64url. */
const TOKEN_LIKE = /^[A-Za-z0-9_-]{20,}$/;

function looksLikeToken(seg: string): boolean {
  if (!TOKEN_LIKE.test(seg)) return false;
  // Слаги статей («kak-ponyat-svoi-potrebnosti») — строчные буквы и дефисы,
  // без цифр: не секрет и в логе полезны. Токен же почти всегда с цифрой или
  // с буквами обоих регистров.
  return /\d/.test(seg) || (/[a-z]/.test(seg) && /[A-Z]/.test(seg));
}

export function safeRequestPath(url: string | undefined): string {
  const path = stripUrlSecrets(url);
  if (!path) return '?';
  const segments = path.split('/');
  return segments
    .map((seg, i) =>
      i > 0 &&
      seg &&
      (TOKEN_PRECEDERS.has(segments[i - 1].toLowerCase()) || looksLikeToken(seg))
        ? '<token>'
        : seg,
    )
    .join('/');
}
