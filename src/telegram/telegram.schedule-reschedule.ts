// Перепланировать напоминание одного человека после смены настроек (сайт,
// /settings бота, «Сегодня не могу»). Вынесено из telegram.schedule.service.ts
// (правило №10).
import type { BotService } from '../bot/bot.service';
import type { NotificationService } from '../notification/notification.service';
import type { NotificationPlannerService } from '../notification/notification.planner.service';
import { localDateString } from '../notification/notification.time';

export interface RescheduleDeps {
  botService: Pick<BotService, 'getUserSettings'>;
  notificationService: Pick<NotificationService, 'cancel' | 'hasPending'>;
  plannerService: Pick<NotificationPlannerService, 'scheduleReminder'>;
}

export async function rescheduleForUser(
  deps: RescheduleDeps,
  userId: bigint,
  now = new Date(),
): Promise<void> {
  const { botService, notificationService, plannerService } = deps;
  const s = await botService.getUserSettings(userId);
  // «Итоги дня» выключены — уже стоящая сводка дня тоже не уходит (R2).
  if (s?.notifySummaryEnabled === false)
    await notificationService.cancel(userId, 'summary');
  if (!s?.notifyEnabled || !s.notifyReminderEnabled) {
    await notificationService.cancel(userId, 'reminder');
    return;
  }
  // На паузе ничего не планируем — юзер попросил тишины
  if (s.notifyPausedUntil && s.notifyPausedUntil > now) return;
  const hadPending = await notificationService.hasPending(userId, 'reminder');
  // due покрывает включение уведомлений после перерыва: nextRemindDate устарел
  // или пуст. Сравнение с сегодняшним днём, а не с днём отправки: день, на
  // который отправка уже спланирована обходом, решает он (E13) — иначе правка
  // настроек вечером ставила бы завтрашнее напоминание в обход его приоритетов.
  const today = localDateString(s.notifyTimezone, now);
  const due = !s.notifyNextRemindDate || today >= s.notifyNextRemindDate;
  if (hadPending || due) {
    await plannerService.scheduleReminder(
      userId,
      s.notifyLocalHour,
      s.notifyTimezone,
      now,
      !!s.notifyGamified,
    );
  }
}
