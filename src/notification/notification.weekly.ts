// «Вчерашний план» по местному дню плана человека (шапка
// notification.planner.service.ts). Обход один, в 00:00 UTC: план берётся за
// последний завершённый местный день, но называется своим днём — «Вчера» только
// если он и правда вчерашний для дня отправки, иначе «План на пятницу».
import { addDaysLocal } from './notification.time';

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/**
 * Как назвать день невыполненного плана в сообщении, которое уйдёт в день
 * `planDate`: накануне — шаблон скажет «Вчера был план» сам (undefined),
 * раньше — «План на пятницу» (номер дня недели 0–6, название — в шаблоне).
 */
export function missedPlanWeekday(
  date: string,
  planDate: string,
): number | undefined {
  if (addDaysLocal(planDate, -1) === date) return undefined;
  return weekday(date);
}
