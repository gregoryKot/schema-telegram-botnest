import { localDate, localMidnightUTC } from '../utils/tz';
import { shiftDay } from '../bot/bot.activity-streak';

// Окно задания-серии («заполнять N дней подряд») — дни, отметки в которых
// идут в прогресс. Дни — по календарю клиента (notifyTimezone), как и сами
// оценки: в нём POST /api/rating кладёт день.
//
// Нижняя граница — день назначения (инцидент 2026-11-04, docs/INCIDENTS.md).
// Верхняя — день назначения + targetDays (E15 аудита 2026-11): до неё окно
// шло до «сейчас», а просрочка ставилась лениво, при открытии /tasks. Клиент,
// не открывавший задания, отмечался после срока — отметки засчитывались, и
// просроченное задание закрывалось выполненным. У закрытого задания окно
// замирает в момент закрытия: прогресс «закрыто · 3 из 7 дней» у терапевта
// больше не растёт от новых отметок.

export const STREAK_TASK_TYPES: readonly string[] = [
  'tracker_streak',
  'diary_streak',
  'schema_diary',
  'mode_diary',
];

/** Дней в серии, если терапевт число не задал. */
export const DEFAULT_STREAK_DAYS = 7;

export interface StreakTaskLike {
  createdAt: Date;
  targetDays?: number | null;
  /** Момент закрытия (выполнено / не вышло); у открытого — null. */
  completedAt?: Date | null;
}

/** Начало окна серии: местный день клиента, в который назначено задание,
 *  и момент его полуночи (для полей-моментов createdAt). */
export function streakWindowStart(
  assignedAt: Date,
  tz: string,
): { day: string; from: Date } {
  const day = localDate(tz, assignedAt);
  return { day, from: localMidnightUTC(day, tz) };
}

/** Окно серии: местные дни `[day, endDay)` и моменты их границ `[from, to)`. */
export function streakWindow(task: StreakTaskLike, tz: string) {
  const { day, from } = streakWindowStart(task.createdAt, tz);
  let endDay = shiftDay(day, task.targetDays ?? DEFAULT_STREAK_DAYS);
  let to = localMidnightUTC(endDay, tz);
  const closed = task.completedAt;
  if (closed && closed < to) {
    // Закрыто раньше конца окна: в счёт идут отметки до закрытия (день
    // закрытия — целиком, у оценок нет момента, только день).
    to = closed;
    const afterClose = shiftDay(localDate(tz, closed), 1);
    if (afterClose < endDay) endDay = afterClose;
  }
  return { day, from, endDay, to };
}

/** Срок серии вышел: у задания есть число дней, и местный день клиента — за окном. */
export function streakExpired(
  task: StreakTaskLike,
  tz: string,
  now = new Date(),
): boolean {
  return (
    !!task.targetDays && localDate(tz, now) >= streakWindow(task, tz).endDay
  );
}

/**
 * У задания есть прогресс серии: это серия с числом дней. Одно условие на
 * /tasks клиента и на карточку у терапевта (правило №4); у закрытого задания
 * число замирает в момент закрытия (`streakWindow`).
 */
export function tracksStreakProgress(task: {
  type: string;
  targetDays: number | null;
}): boolean {
  return !!task.targetDays && STREAK_TASK_TYPES.includes(task.type);
}
