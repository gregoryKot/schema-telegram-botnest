import { LEASE_WINDOW } from '../cron-leader.service';

/**
 * Имя аренды (первый аргумент `claimRun`) → категория `LEASE_WINDOW` её
 * крона. Ручной реестр по правилу №4 CLAUDE.md («денормализация — только с
 * тестом-сверкой»): сверяется с `claimRun(...)` в исходниках и с
 * `scripts/cron-leader-baseline.json` тестом cron-lease-registry.spec.ts —
 * новый leader-крон без строки здесь красит тест, а не молча остаётся
 * невидимым для probe-cron-leases.ts.
 */
export const CRON_LEASE_WINDOW_KEY: Record<string, keyof typeof LEASE_WINDOW> =
  {
    threadsTokenRefresh: 'daily',
    healthyAdultMorning: 'fiveMinutes',
    healthyAdultEvening: 'fiveMinutes',
    healthyAdultCatchUp: 'fifteenMinutes',
    telegramDomainWatchdog: 'hourly',
    bookingReminders: 'fiveMinutes',
    bookingExpireHolds: 'everyMinute',
    notificationQueue: 'fiveMinutes',
    midnightPlanner: 'daily',
  };

/**
 * Номинальный период тика по имени категории. Не берём период из
 * `LEASE_WINDOW` напрямую: окно аренды всегда чуть МЕНЬШЕ периода (иначе
 * законный тик пропускался бы, см. cron-leader.service.ts) — «не старше двух
 * периодов» на самом окне было бы чуть строже, чем просили.
 */
export const NOMINAL_PERIOD_MS: Record<keyof typeof LEASE_WINDOW, number> = {
  everyMinute: 60_000,
  fiveMinutes: 5 * 60_000,
  fifteenMinutes: 15 * 60_000,
  hourly: 3_600_000,
  daily: 24 * 3_600_000,
};

/** Сколько мс аренда может не обновляться, прежде чем считать крон сбойным
 * («не старше двух периодов»). null — имя не зарегистрировано. */
export function maxLeaseAgeMs(name: string): number | null {
  const key = CRON_LEASE_WINDOW_KEY[name];
  return key ? 2 * NOMINAL_PERIOD_MS[key] : null;
}
