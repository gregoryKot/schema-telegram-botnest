import { PrismaService } from '../prisma/prisma.service';
import { StreakTaskLike, streakExpired } from './streak-window';

// Ленивое закрытие задания-серии: срок вышел по календарю клиента — задание
// закрывается «не вышло» (done = false) при первом чтении. Читают задания
// двое: клиент (/tasks, TherapyTasksService.getTasks) и психолог (обзор и
// карточка клиента, therapy-tasks-view.service.ts). До хвоста волны 3 закрывал
// только клиент: психолог видел просроченное открытым, пока клиент не откроет
// «Задания». Код один на оба входа — копия разошлась бы (правило №4).
//
// Запись — только по ещё открытому (`done: null`): клиент и психолог могут
// прочитать одновременно, и отметка «выполнено», пришедшая между чтением и
// записью, не перетирается в «не вышло».

export interface ExpirableTask extends StreakTaskLike {
  id: number;
  done: boolean | null;
}

/**
 * Закрывает просроченные серии в БД; возвращает строки уже с закрытием.
 * Без пояса (виртуальный клиент: своих отметок и календаря нет) — как есть.
 */
export async function closeExpiredStreaks<T extends ExpirableTask>(
  prisma: PrismaService,
  tasks: T[],
  tz: string | undefined,
  now: Date,
): Promise<T[]> {
  if (!tz) return tasks;
  const expired = new Set(
    tasks
      .filter((t) => t.done === null && streakExpired(t, tz, now))
      .map((t) => t.id),
  );
  if (expired.size === 0) return tasks;
  await Promise.all(
    [...expired].map((id) =>
      prisma.userTask.updateMany({
        where: { id, done: null },
        data: { done: false, completedAt: now },
      }),
    ),
  );
  return tasks.map((t) =>
    expired.has(t.id) ? { ...t, done: false, completedAt: now } : t,
  );
}
