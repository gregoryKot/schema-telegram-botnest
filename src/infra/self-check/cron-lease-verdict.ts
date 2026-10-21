import { cronGapsMs } from './cron-gap';
import { latestTicks } from './cron-ticks';

/**
 * Правило пробы `cronLeases`: пропустил ли крон тики, которые этот процесс
 * обязан был отработать. Не «давно ли захватывали аренду» — по возрасту
 * оконный крон канала после аварии базы краснел до следующего окна, до ~16 ч
 * после восстановления (2026-10-17), а до того порог не из того источника уже
 * красил смок круглосуточно (2026-09-16, #503; оба — docs/INCIDENTS.md).
 *
 * Сбой — когда ДВА последних по расписанию тика не захвачены и оба пришлись на
 * зону ответственности процесса: после его старта и после последнего отказа
 * этой аренды из-за недоступной базы (cron-claim-failures.ts). Один пропуск —
 * не сбой: notificationQueue законно выходит по isProcessing до claimRun.
 */

/** Сколько ждать после номинального тика: claimRun — первое, что делает тик,
 * но при больной базе запрос висит до таймаута пула (30 с). */
export const TICK_GRACE_MS = 90_000;
/** Захват чуть раньше номинала (дрожание часов планировщика) — тот же тик. */
export const TICK_TOLERANCE_MS = 5_000;
/** Предел оправданий рестартом и аварией базы: деплои чаще раза в сутки иначе
 * навсегда прятали бы мёртвый суточный крон — его два тика никогда не
 * попадали бы в жизнь одного процесса. */
export const EXCUSE_BACKSTOP_MS = 2 * 24 * 3_600_000;

/** Порог возраста аренды из расписания (`cronGapsMs`): один пропущенный тик
 * допустим, два — нет. Правило для несуточных расписаний и база предела выше. */
export function leaseAgeLimitMs(cron: string): number {
  const { minGapMs, maxGapMs } = cronGapsMs(cron);
  return maxGapMs + minGapMs;
}

/** Расписание аренды — запись CRON_LEASE_REGISTRY. */
export interface LeaseSchedule {
  cron: string;
  tz?: string;
}

export interface LeaseFacts {
  /** Последний захват аренды; нет строки — undefined. */
  runAt?: number;
  now: number;
  /** Старт этого процесса. */
  startedAt: number;
  /** Последний отказ claimRun этой аренды из-за недоступной базы. */
  lastDbFailureAt?: number;
}

function ago(ms: number): string {
  const min = Math.round(ms / 60_000);
  return min < 120 ? `${min} мин назад` : `${Math.round(min / 60)} ч назад`;
}

const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);

/** Прежнее правило — по возрасту: для расписаний, которые не суточные. */
function byAge(f: LeaseFacts, maxAge: number): string | null {
  if (f.runAt === undefined)
    return f.now - f.startedAt > maxAge ? 'ни разу не отработал' : null;
  return f.now - f.runAt > maxAge
    ? `последний раз ${ago(f.now - f.runAt)}`
    : null;
}

/** null — аренда в порядке; строка — что не так, простыми словами. */
export function leaseProblem(
  schedule: LeaseSchedule,
  f: LeaseFacts,
): string | null {
  const maxAge = leaseAgeLimitMs(schedule.cron);
  const ticks = latestTicks(
    schedule.cron,
    new Date(f.now - TICK_GRACE_MS),
    schedule.tz,
  );
  if (!ticks || ticks.length < 2) return byAge(f, maxAge);
  const [t1, t2] = ticks.map((d) => d.getTime());
  if (f.runAt !== undefined && f.runAt >= t2 - TICK_TOLERANCE_MS) return null;

  const coverageStart = Math.max(f.startedAt, f.lastDbFailureAt ?? -Infinity);
  if (t2 > coverageStart) {
    if (f.runAt === undefined) return 'ни разу не отработал';
    return (
      `два тика подряд не отработали (${hhmm(t2)} и ${hhmm(t1)} UTC), ` +
      `последний раз ${ago(f.now - f.runAt)}`
    );
  }
  // Тики пришлись на рестарт или аварию базы — не судим, но не бесконечно.
  if (f.runAt !== undefined && f.now - f.runAt > maxAge + EXCUSE_BACKSTOP_MS)
    return `последний раз ${ago(f.now - f.runAt)}`;
  return null;
}
