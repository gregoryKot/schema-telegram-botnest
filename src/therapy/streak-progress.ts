import { PrismaService } from '../prisma/prisma.service';
import { localDate } from '../utils/tz';
import { StreakTaskLike, streakWindow } from './streak-window';

// Прогресс задания-серии («заполнять N дней подряд»): сколько дней клиент
// отметился В ОКНЕ СЕРИИ — с дня назначения по день назначения + targetDays
// (streak-window.ts). Расчёт один на всех: /tasks клиента, карточка
// задания у терапевта и авто-закрытие (checkStreakTasks) зовут его через
// TherapyTasksService.getStreakProgress — «1 из 7 дней» у обоих одно число
// (правило №4, сверка — therapy-tasks-view.service.spec.ts).
//
// Дни — по календарю клиента (notifyTimezone, по умолчанию Москва), как
// daysSinceActive (#898): в нём POST /api/rating кладёт оценку. До 2026-11-04
// окно было «последние N суток от сейчас»: клиент, который и так отмечался
// неделю, закрывал задание на 7 дней первой же оценкой в день назначения
// (docs/INCIDENTS.md).

export async function streakProgress(
  prisma: PrismaService,
  userId: bigint,
  task: StreakTaskLike & { type: string },
  tz: string,
): Promise<number> {
  const { day, from, endDay, to } = streakWindow(task, tz);
  const inWindow = { gte: day, lt: endDay };
  if (task.type === 'tracker_streak') {
    const dates = await prisma.rating.groupBy({
      by: ['date'],
      where: { userId, date: inWindow },
    });
    return dates.length;
  }
  const since = { userId, createdAt: { gte: from, lt: to } };
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
      where: { userId, date: inWindow },
      select: { date: true },
    }),
  ]);
  const days = new Set([
    ...[...schema, ...mode].map((e) => localDate(tz, e.createdAt)),
    ...gratitude.map((e) => e.date),
  ]);
  return days.size;
}
