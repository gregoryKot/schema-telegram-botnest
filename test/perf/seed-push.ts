// Подписки на уведомления в приложении (PushSubscription) в синтетике
// «горизонт роста» — шаг сидера (test/perf/seed-steps.ts). Читает их тик
// очереди: `loadSendSettings` (src/bot/send-settings.load.ts) — подписки пачки
// людей по `userId IN (…)`, индекс PushSubscription_userId_idx (сценарий
// `notify-queue-tick`), — и блок пушей в /stats.
//
// Форма: подписка у каждого третьего, у половины из них две (телефон и
// ноутбук); уведомления в приложении моложе бота — подписки за последние
// 120 дней; строки лежат в куче по времени. Адрес и ключи в проде зашифрованы
// (push-subscription.store.ts) — здесь заглушки: их никто из замера не читает.
// Итого ~5 000 строк при 10 000 людей. Детерминировано: только арифметика.
import { PERF_ID_BASE as B, PERF_PROFILE as P } from './seed-profile';

/** `a` — SQL-выражение момента запуска сидера (timestamp UTC). */
export function pushSubscriptionSql(a: string): string {
  return `INSERT INTO "PushSubscription"("userId","endpointHash","endpoint","p256dh","auth","createdAt","updatedAt")
SELECT ${B} + s.u, md5('perf-push-' || s.u || '-' || s.k), 'https://push.invalid/perf/' || s.u || '/' || s.k,
  'perf-p256dh', 'perf-auth', s.at, s.at
FROM (
  SELECT u.u, k.k, ${a} - make_interval(days => ((u.u * 7919 + k.k * 31) % 120)::int) AS at
  FROM generate_series(1::bigint, ${P.users}::bigint) u(u)
  CROSS JOIN LATERAL generate_series(1, 1 + (u.u / 3 % 2)::int) k(k)
  WHERE u.u % 3 = 0
) s
ORDER BY s.at, s.u, s.k`;
}
