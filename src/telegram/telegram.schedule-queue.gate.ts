// Что очередь проверяет перед отправкой, кроме адреса: пауза, дневной бюджет,
// тихие часы. Вынесено из telegram.schedule-queue.ts (правило №10).
//
// R5 (аудит 2026-11): `pair_activity` ставится заполнением трекера напарника,
// мимо планировщика, и до этого очередь отправляла его на паузе и вторым
// проактивным за день. Пауза снимает любое проактивное (так обещает
// cancelProactive: поставленное уже после начала паузы — тоже), бюджет —
// парное (notification.budget.ts): остальные проактивные выбирает сам
// планировщик, одно на день, а «⏰ Напомню через час» законно идёт вторым.
import {
  PROACTIVE_TYPES,
  QUIET_EXEMPT_TYPES,
  type DueNotification,
  type NotificationService,
  type NotificationType,
} from '../notification/notification.service';
import type { SendSettings } from '../bot/account.service';
import { proactiveBudgetSpent } from '../notification/notification.budget';
import { isQuietHours, nextQuietEnd } from '../notification/notification.time';

type GateService = Pick<
  NotificationService,
  'cancelOne' | 'defer' | 'countProactiveInDay'
>;

/** true — строка снята или перенесена, отправлять её сейчас не нужно. */
export async function holdBeforeSend(
  notifications: GateService,
  notif: DueNotification,
  s: SendSettings,
  now = new Date(),
): Promise<boolean> {
  const type = notif.type as NotificationType;
  if (PROACTIVE_TYPES.includes(type)) {
    const paused = !!s.pausedUntil && s.pausedUntil > now;
    const overBudget =
      type === 'pair_activity' &&
      (await proactiveBudgetSpent(
        notifications,
        notif.userId,
        s.tz,
        now,
        notif.id,
      ));
    if (paused || overBudget) {
      await notifications.cancelOne(notif.id);
      return true;
    }
  }
  // Тихие часы: проактивные придерживаем до утра. Покрывает и catch-up после
  // даунтайма — уведомление за 21:00 не улетит в 3 ночи.
  if (
    !QUIET_EXEMPT_TYPES.includes(type) &&
    isQuietHours(s.tz, s.start, s.end, now)
  ) {
    await notifications.defer(notif.id, nextQuietEnd(s.tz, s.end, now));
    return true;
  }
  return false;
}
