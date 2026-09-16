import { LEASE_WINDOW } from '../cron-leader.service';
import { cronGapsMs } from './cron-gap';

/**
 * Имя аренды (первый аргумент `claimRun`) → окно `LEASE_WINDOW` и cron-строка
 * её крона. Ручной реестр по правилу №4 CLAUDE.md («денормализация — только
 * с тестом-сверкой»): оба поля сверяются с исходниками через общий сканер
 * `cron-source-scan.ts` тестом cron-lease-registry.spec.ts — новый
 * leader-крон или разъехавшаяся cron-строка красят тест, а не молча остаются
 * невидимыми для probe-cron-leases.ts.
 */
export const CRON_LEASE_REGISTRY: Record<
  string,
  { window: keyof typeof LEASE_WINDOW; cron: string }
> = {
  threadsTokenRefresh: { window: 'daily', cron: '17 3 * * *' },
  healthyAdultMorning: { window: 'fiveMinutes', cron: '*/5 9,10 * * *' },
  healthyAdultEvening: { window: 'fiveMinutes', cron: '*/5 18,19 * * *' },
  healthyAdultCatchUp: { window: 'fifteenMinutes', cron: '*/15 * * * *' },
  telegramDomainWatchdog: { window: 'hourly', cron: '7 * * * *' },
  bookingReminders: { window: 'fiveMinutes', cron: '*/5 * * * *' },
  bookingExpireHolds: { window: 'everyMinute', cron: '* * * * *' },
  notificationQueue: { window: 'fiveMinutes', cron: '*/5 * * * *' },
  midnightPlanner: { window: 'daily', cron: '0 0 * * *' },
};

/**
 * Номинальный период тика по категории — нужен только тесту «окно меньше
 * номинального периода категории» (свойство самого `LEASE_WINDOW`). Порог
 * свежести аренды (`maxLeaseAgeMs`) период отсюда больше не берёт — считает
 * его из расписания через `cronGapsMs`.
 */
export const NOMINAL_PERIOD_MS: Record<keyof typeof LEASE_WINDOW, number> = {
  everyMinute: 60_000,
  fiveMinutes: 5 * 60_000,
  fifteenMinutes: 15 * 60_000,
  hourly: 3_600_000,
  daily: 24 * 3_600_000,
};

/** Сколько мс аренда может не обновляться, прежде чем считать крон сбойным —
 * из расписания (`cronGapsMs`), не «ровно 2 периода» категории окна. null —
 * имя не зарегистрировано. */
export function maxLeaseAgeMs(name: string): number | null {
  const entry = CRON_LEASE_REGISTRY[name];
  if (!entry) return null;
  const { minGapMs, maxGapMs } = cronGapsMs(entry.cron);
  return maxGapMs + minGapMs;
}
