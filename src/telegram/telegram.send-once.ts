// Одиночная отправка в Telegram вне циклов (DM админу, пост канала) с учётом
// ответа 429 «слишком часто».
//
// #812 перевёл очередь и /broadcast на PacedSender, а единичные отправки
// остались мимо него: на 429 Telegram называет срок (`retry_after`), а
// сообщение админу или пост канала падали сразу — алерт уходил в почту или
// терялся, хотя через пять секунд дошёл бы. Здесь тот же PacedSender без паузы
// между отправками: одно ожидание `retry_after`, если оно укладывается в
// бюджет, и один повтор. Не укладывается или повтор снова 429 — бросаем
// последнюю ошибку 429 как есть: её разбирает вызывающий (почта, алерт,
// describeTelegramError). Прочие ошибки не повторяются и пробрасываются сразу.
import { PacedSender, type PaceOptions } from './telegram.paced-sender';

/**
 * Сколько одиночная отправка может ждать по 429. Она стоит в пути HTTP-запроса
 * (бронь, заявка) или крона — дольше держать их нельзя, дальше решает фолбэк.
 */
export const SINGLE_SEND_BUDGET_MS = 10_000;

export type SendOnceOptions = Pick<PaceOptions, 'budgetMs' | 'sleep' | 'now'>;

export async function sendOnce(
  attempt: () => Promise<unknown>,
  opts: SendOnceOptions = {},
): Promise<void> {
  let lastError: unknown = new Error('Telegram: бюджет ожидания исчерпан');
  const result = await new PacedSender({
    pauseMs: 0,
    budgetMs: opts.budgetMs ?? SINGLE_SEND_BUDGET_MS,
    sleep: opts.sleep,
    now: opts.now,
  }).send(async () => {
    try {
      await attempt();
    } catch (err: unknown) {
      lastError = err;
      throw err;
    }
  });
  if (result !== 'sent') throw lastError;
}
