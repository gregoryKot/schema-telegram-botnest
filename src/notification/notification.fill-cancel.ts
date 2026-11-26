import type { NotificationService } from './notification.service';
import { BREAK_TYPES } from './notification.types';
import {
  addDaysLocal,
  localDateString,
  utcInstantForLocalHour,
} from './notification.time';

// Что снимает заполнение трекера (telegram.diary-complete.ts).
//
// E13 (аудит 2026-11): полуночный обход планирует местный день, на который
// выпадает час отправки (шапка NotificationPlannerService), — у Владивостока с
// напоминанием на 08:00 это уже завтрашний день. Раньше заполнение снимало
// ВСЕ напоминания, и вечерняя запись съедала завтрашнее утреннее: в первый же
// пропущенный день напоминания не было. Теперь граница — первый день
// следующего контакта движка частоты (registerFill): каждый день — завтра,
// «через день» — послезавтра. Напоминание на день контакта остаётся.
//
// R4: напоминания о перерыве («Неделя без дневника») снимаются все — человек
// вернулся, перерыва больше нет ни сегодня, ни завтра.

export async function cancelOnFill(
  notifications: Pick<NotificationService, 'cancelTypes'>,
  userId: bigint,
  tz: string,
  now: Date,
  nextContactDate: string | null,
): Promise<void> {
  const today = localDateString(tz, now);
  const tomorrow = addDaysLocal(today, 1);
  const contact =
    nextContactDate && nextContactDate > tomorrow ? nextContactDate : tomorrow;
  await notifications.cancelTypes(
    userId,
    ['reminder', 'pre_reminder'],
    utcInstantForLocalHour(contact, 0, tz),
  );
  // Инсайт о западающей потребности — про сегодняшний день без напоминания;
  // «напарник заполнил трекер» после своей записи тоже не к месту.
  await notifications.cancelTypes(
    userId,
    ['low_streak_insight', 'pair_activity'],
    utcInstantForLocalHour(tomorrow, 0, tz),
  );
  await notifications.cancelTypes(userId, BREAK_TYPES);
}
