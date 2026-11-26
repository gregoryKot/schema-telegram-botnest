import { LEASE_WINDOW } from '../cron-leader.service';

/** Зона кронов канала — `POST_TZ` в channel-schedule.service.ts. */
const MSK = 'Europe/Moscow';

/**
 * Имя аренды (первый аргумент `claimRun`) → окно `LEASE_WINDOW`, cron-строка
 * и пояс (`timeZone` из `@Cron`; нет — зона процесса). Ручной реестр (№4):
 * поля сверяются с исходниками (`cron-source-scan.ts`, cron-lease-registry.spec.ts) —
 * новый leader-крон или разъехавшаяся строка/зона красят тест.
 */
export const CRON_LEASE_REGISTRY: Record<
  string,
  { window: keyof typeof LEASE_WINDOW; cron: string; tz?: string }
> = {
  threadsTokenRefresh: { window: 'daily', cron: '17 3 * * *' },
  healthyAdultMorning: {
    window: 'fiveMinutes',
    cron: '*/5 9,10 * * *',
    tz: MSK,
  },
  healthyAdultEvening: {
    window: 'fiveMinutes',
    cron: '*/5 18,19 * * *',
    tz: MSK,
  },
  healthyAdultCatchUp: {
    window: 'fifteenMinutes',
    cron: '*/15 * * * *',
    tz: MSK,
  },
  introLeadRedelivery: { window: 'fifteenMinutes', cron: '*/15 * * * *' },
  bookingConfirmRetry: { window: 'fiveMinutes', cron: '*/5 * * * *' },
  bookingCalendarReconcile: { window: 'fifteenMinutes', cron: '*/15 * * * *' },
  bookingReminders: { window: 'fiveMinutes', cron: '*/5 * * * *' },
  bookingExpireHolds: { window: 'everyMinute', cron: '* * * * *' },
  notificationQueue: { window: 'fiveMinutes', cron: '*/5 * * * *' },
  weeklyRepeatDigest: { window: 'daily', cron: '23 9 * * 1' },
  midnightPlanner: { window: 'hourly', cron: '0 0 * * *' },
  subscriptionChargeDue: { window: 'hourly', cron: '0 * * * *' },
};
