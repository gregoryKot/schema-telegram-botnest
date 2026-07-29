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
