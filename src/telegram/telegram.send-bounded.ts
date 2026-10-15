// Отправка уведомления с настоящей отменой запроса и разбором исхода
// «неизвестно». Вынесено из telegram.schedule-queue.ts (правило №10).
//
// Аудит 2026-10, r2-3#3. Очередь гоняла `Promise.race([sendMessage, таймер
// 15 с])`. Проигравший запрос не отменялся (у клиента telegraf таймаут
// 500 с), сообщение доезжало до человека, а очередь считала его недоставленным:
// строка оставалась с sentAt=null, и каждый тик (5 минут) слал то же
// напоминание снова, плюс «Failed to send» админу.
//
// Отмена запроса доставку не откатывает: Telegram мог принять сообщение, а мы
// оборвали ожидание ответа. Поэтому при таком исходе выбрано «не больше одного
// раза»: строку помечаем отправленной. Цена выбора — если запрос не дошёл до
// Telegram вовсе, одно напоминание пропадёт; это дешевле повтора каждые 5 минут.
import type { Context, Telegraf, Telegram } from 'telegraf';

export const SEND_TIMEOUT_MS = 15_000;

type SendExtra = Parameters<Telegram['sendMessage']>[2];
type CallSignal = NonNullable<Parameters<Telegram['callApi']>[2]>['signal'];

export async function sendBounded(
  bot: Telegraf<Context>,
  chatId: number,
  text: string,
  extra: SendExtra,
  timeoutMs: number = SEND_TIMEOUT_MS,
): Promise<void> {
  const ac = new AbortController();
  // setTimeout, а не AbortSignal.timeout: фейковые таймеры jest его не двигают.
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    // callApi, а не sendMessage: только он принимает signal.
    await bot.telegram.callApi(
      'sendMessage',
      { chat_id: chatId, text, ...extra },
      // Типы telegraf ждут AbortSignal из пакета abort-controller; во время
      // выполнения node-fetch принимает и штатный сигнал Node.
      { signal: ac.signal as unknown as CallSignal },
    );
  } finally {
    clearTimeout(timer);
  }
}

// Ошибки node-fetch, после которых запрос УЖЕ мог уйти в Telegram.
const SENT_BUT_UNANSWERED_CODES = new Set(['ECONNRESET', 'EPIPE']);
const SENT_BUT_UNANSWERED_TYPES = new Set([
  'aborted',
  'request-timeout',
  'body-timeout',
]);

/**
 * Запрос мог дойти до Telegram, а ответ мы не получили: отмена по нашему
 * таймауту либо обрыв соединения после записи запроса.
 *
 * Не входит сюда (по-прежнему повторяется): ответ API с кодом (Telegram
 * ответил, значит не доставил), ошибки фазы подключения (ENOTFOUND,
 * EAI_AGAIN, ECONNREFUSED, ETIMEDOUT, ENETUNREACH — до Telegram не доехали,
 * инциденты 2026-08-09/11) и 5xx (исход неоднозначен, но в API это ответ с
 * кодом; оставлен повтором, как и был).
 */
export function isUnknownOutcome(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; type?: unknown; code?: unknown };
  if (e.name === 'AbortError') return true;
  if (typeof e.type === 'string' && SENT_BUT_UNANSWERED_TYPES.has(e.type)) {
    return true;
  }
  if (typeof e.code === 'string' && SENT_BUT_UNANSWERED_CODES.has(e.code)) {
    return true;
  }
  return false;
}

// Сколько id показать в итоговой строке: авария — поток (урок 2026-07-29).
const UNKNOWN_SAMPLE = 5;

export function describeUnknownOutcomes(ids: number[]): string {
  return (
    `Очередь: у ${ids.length} уведомлений исход отправки неизвестен ` +
    `(таймаут или обрыв после записи запроса) — помечены отправленными, ` +
    `повтор не шлём. id: ${ids.slice(0, UNKNOWN_SAMPLE).join(', ')}` +
    `${ids.length > UNKNOWN_SAMPLE ? ' …' : ''}`
  );
}
