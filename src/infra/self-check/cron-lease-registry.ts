import { LEASE_WINDOW } from '../cron-leader.service';

/** Зона кронов канала — `POST_TZ` в channel-schedule.service.ts. */
const MSK = 'Europe/Moscow';

/**
 * Имя аренды (первый аргумент `claimRun`) → окно `LEASE_WINDOW`, cron-строка
 * её крона и часовой пояс (`timeZone` из `@Cron`; нет — зона процесса). Ручной
 * реестр по правилу №4 CLAUDE.md: все поля сверяются с исходниками через
 * сканер `cron-source-scan.ts` тестом cron-lease-registry.spec.ts — новый
 * leader-крон, разъехавшаяся cron-строка или зона красят тест, а не остаются
 * невидимыми для пробы аренд (cron-lease-verdict.ts).
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
  telegramDomainWatchdog: { window: 'hourly', cron: '7 * * * *' },
  bookingConfirmRetry: { window: 'fiveMinutes', cron: '*/5 * * * *' },
  bookingReminders: { window: 'fiveMinutes', cron: '*/5 * * * *' },
  bookingExpireHolds: { window: 'everyMinute', cron: '* * * * *' },
  notificationQueue: { window: 'fiveMinutes', cron: '*/5 * * * *' },
  midnightPlanner: { window: 'hourly', cron: '0 0 * * *' },
};
