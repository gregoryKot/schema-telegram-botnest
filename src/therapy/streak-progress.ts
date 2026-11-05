import { PrismaService } from '../prisma/prisma.service';
import { localDate, localMidnightUTC } from '../utils/tz';

// Прогресс задания-серии («заполнять N дней подряд»): сколько дней клиент
// отметился С ДНЯ НАЗНАЧЕНИЯ. Расчёт один на всех: /tasks клиента, карточка
// задания у терапевта и авто-закрытие (checkStreakTasks) зовут его через
// TherapyTasksService.getStreakProgress — «1 из 7 дней» у обоих одно число
// (правило №4, сверка — therapy-tasks-view.service.spec.ts).
//
// Дни — по календарю клиента (notifyTimezone, по умолчанию Москва), как
// daysSinceActive (#898): в нём POST /api/rating кладёт оценку. До 2026-11-04
// окно было «последние N суток от сейчас»: клиент, который и так отмечался
// неделю, закрывал задание на 7 дней первой же оценкой в день назначения
// (docs/INCIDENTS.md).

export const STREAK_TASK_TYPES: readonly string[] = [
  'tracker_streak',
  'diary_streak',
  'schema_diary',
  'mode_diary',
];

/** Начало окна серии: местный день клиента, в который назначено задание,
 *  и момент его полуночи (для полей-моментов createdAt). */
export function streakWindowStart(
  assignedAt: Date,
  tz: string,
): { day: string; from: Date } {
  const day = localDate(tz, assignedAt);
  return { day, from: localMidnightUTC(day, tz) };
}

export async function streakProgress(
  prisma: PrismaService,
  userId: bigint,
  task: { type: string; createdAt: Date },
  tz: string,
): Promise<number> {
  const { day, from } = streakWindowStart(task.createdAt, tz);
  if (task.type === 'tracker_streak') {
    const dates = await prisma.rating.groupBy({
      by: ['date'],
      where: { userId, date: { gte: day } },
    });
    return dates.length;
  }
  const since = { userId, createdAt: { gte: from } };
  if (task.type === 'schema_diary') {
    return prisma.schemaDiaryEntry.count({ where: since });
  }
  if (task.type === 'mode_diary') {
    return prisma.modeDiaryEntry.count({ where: since });
  }
  // diary_streak: день с любой записью (схемы, режима или благодарности)
  const [schema, mode, gratitude] = await Promise.all([
    prisma.schemaDiaryEntry.groupBy({ by: ['createdAt'], where: since }),
    prisma.modeDiaryEntry.groupBy({ by: ['createdAt'], where: since }),
    prisma.gratitudeDiaryEntry.findMany({
      where: { userId, date: { gte: day } },
      select: { date: true },
    }),
  ]);
  const days = new Set([
    ...[...schema, ...mode].map((e) => localDate(tz, e.createdAt)),
    ...gratitude.map((e) => e.date),
  ]);
  return days.size;
}
