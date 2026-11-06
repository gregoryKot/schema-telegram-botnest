// Последняя линия оповещения админа: Telegram, при отказе — e-mail (Resend).
// Без DI (читает env): работает и в AlertLogger, созданном раньше контейнера.
// Ничего не бросает и не логирует уровнем error — он вернулся бы через
// AlertLogger в этот же фолбэк. Итог письма — в alert-email-health.ts.
// Env: BOT_TOKEN, ADMIN_ID · RESEND_API_KEY, ADMIN_EMAIL, EMAIL_FROM
import {
  noteAlertEmailError,
  noteAlertEmailResponse,
} from './alert-email-health';
import { practiceOwnerTelegramId } from './practice-owner';
import { sendOnce } from '../telegram/telegram.send-once';

/** Числовой ADMIN_ID из env (null, если не задан/некорректен). Разбор — practice-owner.ts. */
export function adminIdNum(): number | null {
  return practiceOwnerTelegramId();
}

/**
 * Единая проверка «отправитель — админ» для бот-хендлеров (аудит 2026-07,
 * 2в: разбор ADMIN_ID был скопипащен по хендлерам 7 раз).
 */
export function isAdminSender(from: { id?: number } | undefined): boolean {
  const a = adminIdNum();
  return a !== null && from?.id === a;
}

export interface NotifyOptions {
  /**
   * Не пытаться слать в Telegram. Нужно, когда сбой — в самом Telegram:
   * сообщение о его недоступности по нему же не доставить (инцидент
   * 2026-08-09: канал падал три дня, алерты уходили в никуда).
   */
  skipTelegram?: boolean;
}

export async function notifyAdminWithFallback(
  text: string,
  subject = 'Уведомление SchemeHappens',
  options: NotifyOptions = {},
): Promise<void> {
  if (!options.skipTelegram && (await sendTelegram(text))) return;
  await sendEmail(subject, text);
}

async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.BOT_TOKEN;
  const chatId = practiceOwnerTelegramId();
  if (!token || chatId === null) return false;
  try {
    // 429 — ожидание retry_after и один повтор; дольше бюджета — письмо.
    await sendOnce(() => postMessage(token, chatId, text));
    return true;
  } catch {
    return false;
  }
}

/** Ответ не ok — ошибка с телом ответа: по нему sendOnce узнаёт 429 и срок. */
async function postMessage(token: string, chatId: number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return;
  // Тело — только у 429 (в нём срок). Не JSON — ошибка разбора, и сразу письмо.
  const response: unknown = res.status === 429 ? await res.json() : null;
  throw Object.assign(new Error(`Telegram ответил ${res.status}`), {
    response,
  });
}

async function sendEmail(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  const from =
    process.env.EMAIL_FROM ?? 'SchemeHappens <no-reply@schemehappens.ru>';
  if (!apiKey || !to) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: text.replace(/<[^>]+>/g, ''),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    noteAlertEmailResponse(res);
  } catch (e) {
    noteAlertEmailError(e);
  }
}
