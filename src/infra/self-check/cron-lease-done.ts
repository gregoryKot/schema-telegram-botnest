import { RESUME_WINDOW_MS } from '../../telegram/telegram.midnight-lease';
import { CRON_LEASE_REGISTRY } from './cron-lease-registry';
import { hhmm, leaseProblem, type LeaseFacts } from './cron-lease-verdict';

/**
 * Второе правило пробы `cronLeases`: прогон захвачен, но не дошёл до конца.
 * Правило тиков (cron-lease-verdict.ts) смотрит только на факт захвата, и
 * обход, оборванный деплоем, для него «свеж» — хвост пользователей сутки без
 * напоминаний, а проба зелёная (аудит 2026-10). Судятся только аренды, чей
 * прогон отмечает завершение (`finishRun`, src/infra/cron-run-done.ts):
 * у остальных `doneRunAt` пуст всегда. Список сверяется с исходниками в
 * cron-lease-registry.spec.ts в обе стороны (правило №4).
 */
export const COMPLETING_LEASES: ReadonlySet<string> = new Set([
  'midnightPlanner',
]);

/** Обход всех пользователей идёт минуты; два часа — запас на медленную базу,
 * а не на штатную работу. Отсчёт — от позднего из «прогон начат» и «процесс
 * поднялся»: рестарт получает те же два часа на доделку (старт её начинает
 * через 30 с). */
export const UNFINISHED_GRACE_MS = 2 * 3_600_000;

/** Доделка начинается не в момент старта, а после загрузки и 30-секундной
 * задержки (catchupTimer в telegram.schedule.service.ts). Прогон, начатый
 * чуть меньше чем за RESUME_WINDOW_MS до старта, к ней уже выйдет из окна. */
export const RESUME_START_SLACK_MS = 5 * 60_000;

export interface RunDoneFacts {
  runAt?: number;
  doneRunAt?: number;
  now: number;
  /** Старт этого процесса. */
  startedAt: number;
}

/** null — прогон завершён или ещё в пределах запаса; строка — что не так. */
export function unfinishedRunProblem(
  name: string,
  f: RunDoneFacts,
): string | null {
  if (!COMPLETING_LEASES.has(name) || f.runAt === undefined) return null;
  if (f.doneRunAt === f.runAt) return null;
  // Отметки не было ни разу, а прогон начат раньше, чем этот процесс мог бы
  // его доделать (доделка — только в RESUME_WINDOW_MS, считая от момента
  // доделки, а не старта): доделать его некому, и красная проба провисела бы
  // до полуночи. Так выглядит первый деплой колонки doneRunAt днём — прошлый
  // обход прошёл старым кодом, который отметку не ставил. Отметка от прошлого
  // прогона (doneRunAt ≠ runAt) сюда не попадает: это настоящий оборванный
  // обход, он судится.
  const tooOld = f.startedAt - RESUME_WINDOW_MS + RESUME_START_SLACK_MS;
  if (f.doneRunAt === undefined && f.runAt <= tooOld) return null;
  if (f.now - Math.max(f.runAt, f.startedAt) <= UNFINISHED_GRACE_MS)
    return null;
  return `обход, начатый в ${hhmm(f.runAt)} UTC, не дошёл до конца — часть людей осталась без запланированных сообщений`;
}

/** Оба правила по строке аренды: сначала тики, потом незавершённый прогон. */
export function leaseRowProblem(
  name: string,
  row: { runAt: Date; doneRunAt: Date | null } | undefined,
  ctx: Omit<LeaseFacts, 'runAt'>,
): string | null {
  const runAt = row?.runAt.getTime();
  const doneRunAt = row?.doneRunAt?.getTime();
  const { now, startedAt } = ctx;
  return (
    leaseProblem(CRON_LEASE_REGISTRY[name], { ...ctx, runAt }) ??
    unfinishedRunProblem(name, { runAt, doneRunAt, now, startedAt })
  );
}
