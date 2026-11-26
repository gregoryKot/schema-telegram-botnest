import { NEED_IDS } from '../bot/bot.service';
import type { DiaryCompleteDeps } from './telegram.diary-complete';
import { proactiveBudgetSpent } from '../notification/notification.budget';

// Парный триггер (аудит 2026-07, этап 4.5): юзер заполнил трекер — мягко
// подсказать активным напарникам. Вынесено из telegram.diary-complete.ts
// (правило №10). Ограничители: «Напоминания» напарника включены
// (notifyEnabled) и не на паузе; он сегодня ещё не заполнил сам; его местный
// день не занят другим проактивным сообщением (дневной бюджет,
// notification.budget.ts) — это же держит «не больше одного pair_activity в
// день». Пауза и бюджет до R5 (аудит 2026-11) не проверялись: напарник на
// паузе получал «напарник заполнил трекер», а в день напоминания — два
// сообщения. Очередь перепроверяет то же самое (telegram.schedule-queue.gate.ts).
export async function maybeNotifyPairPartners(
  deps: Pick<
    DiaryCompleteDeps,
    'pairsService' | 'botService' | 'notificationService'
  >,
  userId: bigint,
  now = new Date(),
): Promise<void> {
  const pairs = await deps.pairsService.getUserPairs(userId);
  for (const pair of pairs) {
    if (pair.status !== 'active' || pair.partnerId === null) continue;
    const partnerId = pair.partnerId;

    const settings = await deps.botService.getUserSettings(partnerId);
    if (!settings || settings.notifyEnabled === false) continue;
    if (settings.notifyPausedUntil && settings.notifyPausedUntil > now)
      continue;

    // Напарник уже заполнил сегодня сам — подсказка не нужна.
    const partnerRatings = await deps.botService.getRatings(partnerId);
    if (NEED_IDS.every((id) => partnerRatings[id] !== undefined)) continue;

    const tz = settings.notifyTimezone ?? 'Europe/Moscow';
    if (
      await proactiveBudgetSpent(deps.notificationService, partnerId, tz, now)
    )
      continue;

    await deps.notificationService.schedule(partnerId, 'pair_activity', now);
  }
}
