import { cronGapsMs } from './cron-gap';

/** Расписание часового крона самопроверки. Литерал в `@Cron(...)` сервиса
 * сверяется с этой константой тестом freshness.spec.ts (правило №4): сканер
 * кронов резолвит константы только в том же файле. */
export const SELF_CHECK_CRON = '43 * * * *';

/** Грейс после старта процесса, пока снимка ещё нет: 60 с задержки первого
 * прогона (POST_DEPLOY_DELAY_MS) + не более 10 с самого прогона (`runProbes`
 * гоняет пробы параллельно, каждая ограничена PROBE_TIMEOUT_MS) + буст Nest и
 * запас на рестарт супервизора. Меньше ~3 мин дало бы ложно-красный смок в
 * окне деплоя. */
export const STARTUP_GRACE_MS = 10 * 60_000;

/** Возраст снимка, после которого часовой крон считается остановившимся: один
 * пропущенный тик допустим, два — нет (та же формула, что `leaseAgeLimitMs`). */
export function maxSnapshotAgeMs(): number {
  const { minGapMs, maxGapMs } = cronGapsMs(SELF_CHECK_CRON);
  return maxGapMs + minGapMs;
}

/**
 * Протух ли снимок самопроверки. `selfCheckHourly` намеренно вне
 * CRON_LEASE_REGISTRY (наблюдатель себя не видит), поэтому остановку крона
 * замечает только смок прода по `/health.selfCheck.stale`.
 *
 * Снимок живёт в памяти процесса, а часовой прогон идёт только у лидера
 * аренды: у не-лидера снимок остаётся от post-deploy и честно считается
 * протухшим (при одном инстансе на VPS не проявляется).
 */
export function isSnapshotStale(
  snap: { ranAt: number | null },
  now: number,
  uptimeMs: number,
): boolean {
  if (snap.ranAt === null) return uptimeMs > STARTUP_GRACE_MS;
  return now - snap.ranAt > maxSnapshotAgeMs();
}
