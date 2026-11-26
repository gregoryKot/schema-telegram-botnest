-- P6 (docs/PERF_PLANS.md): тик очереди уведомлений раз в минуту —
-- getDue (src/notification/notification.service.ts): sendAt <= now AND
-- sentAt IS NULL AND cancelledAt IS NULL ORDER BY sendAt LIMIT 500 — шёл по
-- (sendAt, sentAt, cancelledAt): границу скана давал только sendAt, условия на
-- NULL проверялись внутри индекса, и каждый тик проходил всю историю очереди
-- до now (2 266 страниц из 3 461 у сценария notify-queue-tick; таблицу никто
-- не чистит — число росло каждый день).
--
-- Взамен — два индекса (правило №28: индекс с теми же ведущими колонками
-- заменяется, а не добавляется):
--   1) частичный по sendAt только для ждущих строк: в нём лишь очередь, а не
--      история; строка уходит из индекса, как только её отправили или отменили.
--      Prisma частичные индексы не описывает — он живёт здесь (как
--      TherapyRelation_active_pair_key), в schema.prisma — комментарий;
--   2) (type, sendAt): второй читатель старого индекса — /stats «Напомню через
--      час» (src/bot/notify-queue-metrics.service.ts, pre_reminder по окну
--      sendAt) — без него шёл бы последовательным сканом.
-- Остальные запросы очереди ведёт (userId, type, sentAt). Обычный CREATE INDEX,
-- не CONCURRENTLY (миграция в транзакции). Идемпотентна целиком.
CREATE INDEX IF NOT EXISTS "ScheduledNotification_due_sendAt_idx"
  ON "ScheduledNotification" ("sendAt")
  WHERE "sentAt" IS NULL AND "cancelledAt" IS NULL;

CREATE INDEX IF NOT EXISTS "ScheduledNotification_type_sendAt_idx"
  ON "ScheduledNotification" ("type", "sendAt");

DROP INDEX IF EXISTS "ScheduledNotification_sendAt_sentAt_cancelledAt_idx";
