// Ответ Telegram «слишком часто» (HTTP 429) — разбор внешнего формата.
//
// Аудит 2026-10: `retry_after` не читался нигде. Очередь уведомлений шла по
// 500 строкам подряд без паузы, 429 падал в общую ветку «временная ошибка»,
// и цикл продолжал слать под лимитом. Bot API в этом случае кладёт в ответ
// `parameters.retry_after` — сколько секунд ждать до следующего запроса
// (https://core.telegram.org/bots/api#responseparameters). Повтор раньше
// этого срока продлевает ограничение, а не снимает его.
//
// Telegraf отдаёт тело ответа как есть: `TelegramError.response` — это JSON
// от Telegram (node_modules/telegraf/lib/core/network/error.js). Форма
// проверена на записанном ответе: test/fixtures/recorded/
// telegram-429-too-many-requests.json.
//
// Отдельным файлом, а не веткой в telegram-error.ts: это парсер ответа
// площадки, и гейт записанных фикстур заводит его по пути (правило №23).

interface RateLimitedResponse {
  error_code?: unknown;
  parameters?: { retry_after?: unknown };
}

function responseOf(err: unknown): RateLimitedResponse | null {
  if (!err || typeof err !== 'object') return null;
  const res = (err as { response?: unknown }).response;
  return res && typeof res === 'object' ? res : null;
}

/** Telegram ответил 429: запросы с этого бота сейчас идут слишком часто. */
export function isRateLimited(err: unknown): boolean {
  return responseOf(err)?.error_code === 429;
}

/**
 * Сколько ждать перед повтором, в миллисекундах. `null` — ответ не 429 либо
 * Telegram срок не назвал: тогда ждать «наугад» нельзя, вызывающий
 * останавливается и пробует в следующий заход.
 */
export function retryAfterMs(err: unknown): number | null {
  const res = responseOf(err);
  if (res?.error_code !== 429) return null;
  const seconds = res.parameters?.retry_after;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  if (seconds <= 0) return null;
  return Math.ceil(seconds * 1000);
}
