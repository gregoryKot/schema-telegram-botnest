// Исходы сбоя отправки из очереди (вынесено из telegram.schedule-queue.ts).
import { classifySendFailure, describeTelegramError } from './telegram-error';
import { isUnknownOutcome } from './telegram.send-bounded';
import type { QueueDeps } from './telegram.schedule-queue';

export async function handleSendError(
  deps: QueueDeps,
  id: number,
  userId: bigint | number,
  err: unknown,
  seen: { unknown: number[]; transient: number },
): Promise<void> {
  const { accountService, notificationService, logger } = deps;
  // Запрос оборван, а Telegram мог его принять: повтор дал бы дубль каждые
  // 5 минут. Метим отправленным и сообщаем одной строкой на тик.
  if (isUnknownOutcome(err)) {
    await notificationService.markSent(id);
    seen.unknown.push(id);
    return;
  }
  const verdict = classifySendFailure(err);
  const desc = describeTelegramError(err);

  if (verdict === 'transient') {
    // Наша ошибка (разметка, длина, сеть) — не метим человека и не помечаем
    // отправленным: повтор на следующем тике (429 — в telegram.paced-sender).
    seen.transient++;
    logger.error(`Failed to send notification id=${id} (${desc})`, err);
    return;
  }

  // Оба оставшихся исхода означают «по этому адресу писать больше нельзя»,
  // поэтому оба ставят флаг и перестают долбиться каждую ночь. Разводим их
  // в ЛОГЕ: раньше причина терялась, и «человек закрыл бота» было не отличить
  // от «мы пишем не туда» — а именно второе и было массовым.
  await notificationService.markSent(id);
  await accountService.markUserBlocked(BigInt(userId));
  const reason = verdict === 'blocked' ? 'bot blocked' : 'chat_not_found';
  logger.warn(`Skipping notification id=${id} — ${reason} (${desc})`);
}
