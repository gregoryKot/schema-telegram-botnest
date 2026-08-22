// Разбор возврата с oauth.telegram.org/auth?embed=0 — чистая функция без
// React, чтобы тестировать логику отдельно от эффекта (см. TelegramWidgetCallback.tsx).
//
// Инцидент 2026-08-21: «вход через Telegram — приходит подтверждение в
// телегу, подтверждаю, пишет ошибка, со второго раза срабатывает». Причина —
// oauth.telegram.org возвращает данные ТРЕМЯ разными способами, а страница
// читала только один:
//   1. hash-фрагмент      #tgAuthResult=BASE64URL_JSON  (обычно повторный вход)
//   2. query-параметр     ?tgAuthResult=BASE64URL_JSON  (иногда первый вход)
//   3. плоский query      ?id=...&hash=...&first_name=...  (обычно первый вход,
//      когда человек реально подтверждает в Telegram)
// Страница читала только (1) — первый вход (2 или 3) уходил в
// telegram_no_data, второй (случайно совпадавший с форматом 1) — срабатывал.

export type TelegramAuthResultOutcome =
  | { kind: 'none' }
  | { kind: 'error' }
  | { kind: 'ok'; fields: Record<string, string> };

/**
 * Декодирует base64url JSON с ПРАВИЛЬНОЙ обработкой UTF-8.
 *
 * `atob()` возвращает бинарную строку (по одному code unit на БАЙТ входных
 * данных) — кириллица в `first_name` («Григорий») при таком декодировании
 * превращается в мусор, уходит на сервер, HMAC не сходится с тем, что
 * Telegram подписал → 401 «Invalid Telegram signature». Сервер декодирует
 * через `Buffer.from(x, 'base64url').toString('utf8')` — здесь тот же
 * результат получаем через TextDecoder: атОб() даёт байты как code units,
 * Uint8Array.from их подбирает обратно в байты, TextDecoder собирает UTF-8.
 */
function decodeBase64UrlJson(value: string): Record<string, unknown> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as Record<string, unknown>;
}

/** null/undefined отфильтрованы, остальное приведено к строке — как ждёт verifyClientData на бэкенде. */
function flattenFields(source: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  );
}

/**
 * Разбирает возврат с oauth.telegram.org по всем трём форматам.
 * `hash` — `window.location.hash` (с `#` или без), `search` — `window.location.search`.
 */
export function parseTelegramAuthResult(
  hash: string,
  search: string,
): TelegramAuthResultOutcome {
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(search.replace(/^\?/, ''));

  const tgAuthResult =
    hashParams.get('tgAuthResult') ?? searchParams.get('tgAuthResult');
  if (tgAuthResult) {
    try {
      return { kind: 'ok', fields: flattenFields(decodeBase64UrlJson(tgAuthResult)) };
    } catch {
      return { kind: 'error' };
    }
  }

  // Плоский Login Widget формат: ?id=...&hash=...&first_name=... — без
  // обёртки в tgAuthResult. id и hash обязательны у Telegram-подписи, их
  // наличие вместе — надёжный признак «это реально данные от Telegram»,
  // а не случайный query-параметр с других переходов.
  if (searchParams.get('id') && searchParams.get('hash')) {
    return { kind: 'ok', fields: flattenFields(Object.fromEntries(searchParams)) };
  }

  return { kind: 'none' };
}
