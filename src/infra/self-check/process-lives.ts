import type { PrismaService } from '../../prisma/prisma.service';
import { INSTANCE_ID } from '../cron-leader.service';

/**
 * Жизни процессов приложения в Postgres — для пробы `cronLeases`
 * (cron-lease-verdict.ts, аудит 2026-10).
 *
 * Проба прощала тики до старта своего процесса: память процесса не знает,
 * работал ли кто-то в тот момент. При деплоях чаще раза в сутки два суточных
 * тика никогда не попадали в жизнь одного процесса, и мёртвый суточный крон
 * ловился только пределом «двое суток сверх порога» — на 4-е сутки. Теперь
 * каждый процесс при прогоне пробы отмечается строкой: старт, последний прогон
 * пробы (`seenAt`) и последний отказ аренды из-за недоступной базы. Тик,
 * пришедшийся на жизнь прошлого процесса, судится так же, как тик своей.
 *
 * Отметка — только при прогоне пробы (через минуту после старта и раз в час):
 * последний час жизни прошлого процесса не покрыт, тики в нём по-прежнему
 * прощаются — ошибка в сторону молчания, а не ложной тревоги. `seenAt`
 * двигается только удачной записью, и та же запись несёт отказ базы: тики
 * аварии, которую прошлый процесс пережил, прощаются и после деплоя
 * (тот же класс, что 2026-10-17, docs/INCIDENTS.md).
 */

/** Сколько помнить: предел оправданий суточного крона — 4 суток, с запасом. */
export const LIVES_KEEP_MS = 7 * 24 * 3_600_000;

/** Отрезок, когда прошлый процесс работал с базой: [from, to]. */
export interface ProcessSpan {
  from: number;
  to: number;
}

export interface ThisProcess {
  startedAt: number;
  now: number;
  /** Последние отказы аренд из-за недоступной базы (память процесса). */
  failures: (number | undefined)[];
}

type Db = Pick<PrismaService, 'processLife'>;

/** Поздний из отказов базы; не было — null. */
function lastFailure(failures: (number | undefined)[]): Date | null {
  const known = failures.filter((f): f is number => f !== undefined);
  return known.length > 0 ? new Date(Math.max(...known)) : null;
}

/** Отметить этот процесс и вернуть отрезки жизни прошлых. */
export async function syncProcessLives(
  prisma: Db,
  me: ThisProcess,
  instanceId: string = INSTANCE_ID,
): Promise<ProcessSpan[]> {
  // Время старта в ключе: перезапуск того же контейнера — новая жизнь.
  const id = `${instanceId}@${new Date(me.startedAt).toISOString()}`;
  const seen = {
    seenAt: new Date(me.now),
    dbFailureAt: lastFailure(me.failures),
  };
  await prisma.processLife.upsert({
    where: { id },
    create: { id, startedAt: new Date(me.startedAt), ...seen },
    update: seen,
  });
  await prisma.processLife.deleteMany({
    where: { seenAt: { lt: new Date(me.now - LIVES_KEEP_MS) } },
  });
  const rows = await prisma.processLife.findMany({
    where: { id: { not: id } },
    select: { startedAt: true, seenAt: true, dbFailureAt: true },
  });
  return rows.map((r) => ({
    from: Math.max(r.startedAt.getTime(), r.dbFailureAt?.getTime() ?? 0),
    to: r.seenAt.getTime(),
  }));
}
