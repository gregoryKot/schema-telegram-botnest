import type { NotificationService } from './notification.service';
import {
  addDaysLocal,
  localDateString,
  utcInstantForLocalHour,
} from './notification.time';

// Дневной бюджет проактивных: одно сообщение, которое бот пишет сам, на
// местный день человека (шапка NotificationPlannerService). Планировщик держит
// его сам — выбирает одно на день. Мимо него ходит только `pair_activity`: его
// ставит заполнение трекера напарником, в любой час. До R5 (аудит 2026-11) он
// приходил вторым сообщением за день — после напоминания или вместе с ним.
//
// Парное уступает: день занят, если в нём уже ушло проактивное или на него
// стоит запланированное (напоминание на 21:00 видно с утра). Проверка — при
// постановке (telegram.pair-activity.ts) и в очереди
// (telegram.schedule-queue.gate.ts): отложенное тихими часами до утра
// приходит уже в другой день, и там его место может быть занято.

/** Границы местного дня, в котором лежит момент now. */
export function localDayBounds(
  tz: string,
  now: Date,
): { start: Date; end: Date } {
  const today = localDateString(tz, now);
  return {
    start: utcInstantForLocalHour(today, 0, tz),
    end: utcInstantForLocalHour(addDaysLocal(today, 1), 0, tz),
  };
}

/** Занят ли местный день человека другим проактивным сообщением. */
export async function proactiveBudgetSpent(
  notifications: Pick<NotificationService, 'countProactiveInDay'>,
  userId: bigint,
  tz: string,
  now: Date,
  exceptId?: number,
): Promise<boolean> {
  const { start, end } = localDayBounds(tz, now);
  const taken = await notifications.countProactiveInDay(
    userId,
    start,
    end,
    exceptId,
  );
  return taken > 0;
}
