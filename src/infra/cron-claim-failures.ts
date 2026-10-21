import { isConnectionError } from '../logger/db-outage';

/**
 * Когда тик крона в последний раз не смог взять аренду из-за недоступной
 * базы — по имени аренды, в памяти процесса. Читает проба `cronLeases`
 * (cron-lease-verdict.ts): тик, пришедшийся на аварию базы, процесс
 * отработать не мог, и судить крон за него нельзя. Без этой памяти проба
 * держала оконные кроны канала красными до следующего окна — до ~16 ч после
 * восстановления базы (2026-10-17, docs/INCIDENTS.md). После рестарта память
 * пуста, но тогда те же тики прикрывает время старта процесса.
 *
 * Оправдывает только недоступность базы. Ошибка другого рода (таблицы
 * `CronLease` нет после кривой миграции, сломанный запрос) — крон мёртв, и
 * проба обязана краснеть, поэтому такие отказы сюда не пишутся.
 */
const lastDbFailureAt = new Map<string, number>();

/** Отказ пула выдать соединение: pg-pool пишет его своими словами, без
 * кода Prisma (`P2024` — тот же смысл в старом движке, он уже в списке
 * признаков db-outage.ts). */
const POOL_CHECKOUT_TIMEOUT = /timeout exceeded when trying to connect/i;

/** Недоступна ли база, судя по ошибке `claimRun`. Контекст «это база» здесь
 * задан самим вызовом — поэтому мягкая проверка обрыва соединения, а не
 * строгая `isDbUnreachable`, которой нужно упоминание БД в тексте. */
export function isClaimDbOutage(err: unknown): boolean {
  if (isConnectionError(err)) return true;
  const message = err instanceof Error ? err.message : String(err);
  return POOL_CHECKOUT_TIMEOUT.test(message);
}

/** Запомнить отказ захвата аренды `name` в момент тика `at`. */
export function noteClaimFailure(name: string, err: unknown, at: Date): void {
  if (isClaimDbOutage(err)) lastDbFailureAt.set(name, at.getTime());
}

/** Момент последнего отказа аренды `name` из-за недоступной базы. */
export function lastClaimDbFailureAt(name: string): number | undefined {
  return lastDbFailureAt.get(name);
}
