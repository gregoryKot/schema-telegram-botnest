/**
 * Человекочитаемая причина сбоя Telegram-запроса.
 *
 * Инцидент 2026-07-29: канал не публиковался, а в алерте админу приезжало
 * «request to https://api.telegram.org/bot…/sendMessage failed, reason:» —
 * и на этом всё. Причина обрывалась, потому что транспортная ошибка
 * (node-fetch внутри telegraf) кладёт пустой `message`, а код сбоя живёт
 * рядом — в `code`/`errno`/`cause.code`. Алерт без причины бесполезен:
 * по нему нельзя отличить «нет сети до Telegram» от «бот не админ канала».
 */

interface TelegramApiError {
  response?: { error_code?: number; description?: string };
}

interface TransportError {
  code?: string;
  errno?: string | number;
  cause?: { code?: string; message?: string };
}

function asObject(err: unknown): Record<string, unknown> | null {
  return err && typeof err === 'object'
    ? (err as Record<string, unknown>)
    : null;
}

/** Код ответа Telegram API (400/403/…), если сбой пришёл от самого API. */
export function telegramErrorCode(err: unknown): number | undefined {
  return (asObject(err) as TelegramApiError | null)?.response?.error_code;
}

export function describeTelegramError(err: unknown): string {
  const obj = asObject(err);
  // Ответ самого API — самая полезная форма: «400: chat not found».
  const api = (obj as TelegramApiError | null)?.response;
  if (api?.description) {
    return api.error_code
      ? `${api.error_code}: ${api.description}`
      : api.description;
  }
  // Транспорт: до Telegram не доехали. Код сбоя (ETIMEDOUT/ENOTFOUND/…)
  // информативнее текста и обязан попасть в алерт.
  const t = obj as TransportError | null;
  const code = t?.code ?? t?.cause?.code ?? (t?.errno ? String(t.errno) : null);
  const message =
    err instanceof Error && err.message
      ? err.message
      : (t?.cause?.message ?? '');
  if (code) return message ? `${code} (${message})` : code;
  return message || 'неизвестная ошибка';
}

/**
 * Что делать со сбоем отправки. Раньше это решение принимали два одинаковых
 * регэкспа — в очереди уведомлений и в рассылке, — и оба складывали «чата
 * нет» и «бот заблокирован» в один исход: пометить человека `botBlockedAt`.
 * Исходы разные. Заблокировал бота — человек так решил. Чата нет — мы просто
 * пишем не туда (после слияния аккаунтов адрес живёт в AuthProvider, а не в
 * userId), и молчаливый флаг выключает уведомления тому, кто ни о чём не
 * просил.
 *
 * `transient` — всё остальное: разметка не разобралась, сообщение длиннее
 * лимита, сеть отвалилась. Это наши ошибки, за них человека метить нельзя.
 */
export type SendFailure = 'blocked' | 'chat_not_found' | 'transient';

export function classifySendFailure(err: unknown): SendFailure {
  const code = telegramErrorCode(err);
  const desc = describeTelegramError(err);
  if (code === 403) return 'blocked';
  if (code === 400) {
    if (/chat not found/i.test(desc)) return 'chat_not_found';
    if (/user is deactivated|bot was blocked|kicked/i.test(desc)) {
      return 'blocked';
    }
  }
  return 'transient';
}
