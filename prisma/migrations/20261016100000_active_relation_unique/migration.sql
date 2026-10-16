-- «Одна активная связь на пару» (аудит 2026-10, слияние аккаунтов плодило дубли):
-- до сих пор инвариант жил только в `findFirst → alreadyConnected`, а уникальности
-- в базе не было. Дубли получались двумя путями: слияние аккаунтов (ремап
-- therapistId/clientId и userId1/userId2 без дедупа) и гонка двух приглашений;
-- у Pair — ещё и «B вступил по коду A, затем A по коду B» (две строки (A,B) и (B,A)).
-- Клиент у терапевта и партнёр у друга показывались дважды.
--
-- 1. Дедуп существующих дублей (иначе CREATE UNIQUE INDEX упадёт, получим P3009 и
--    крашлуп прода, инцидент 2026-07-16). Остаётся строка с минимальным id.
--    TherapyRelation: лишняя НЕ удаляется, а завершается (`ended`) — alias и даты
--    остаются в строке, заметки и карты ключуются по (therapistId, clientId), а не
--    по id связи. Виртуальные клиенты (clientId IS NULL) не дубли друг друга.
--    Pair: лишняя удаляется — кроме code и createdAt в ней данных нет, а
--    getUserPairs отдаёт все статусы, так что `ended`-дубль остался бы в списке.
-- 2. Частичные уникальные индексы. Только по active: pending/ended историю не
--    ограничивают. Обычный CREATE INDEX, не CONCURRENTLY (миграция в транзакции).
-- Идемпотентно: повторный прогон не находит дублей, индексы IF NOT EXISTS.

UPDATE "TherapyRelation" r
SET "status" = 'ended'
WHERE r."status" = 'active'
  AND r."clientId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "TherapyRelation" k
    WHERE k."status" = 'active'
      AND k."therapistId" = r."therapistId"
      AND k."clientId" = r."clientId"
      AND k."id" < r."id"
  );

DELETE FROM "Pair" p
WHERE p."status" = 'active'
  AND p."userId2" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Pair" k
    WHERE k."status" = 'active'
      AND k."userId2" IS NOT NULL
      AND LEAST(k."userId1", k."userId2") = LEAST(p."userId1", p."userId2")
      AND GREATEST(k."userId1", k."userId2") = GREATEST(p."userId1", p."userId2")
      AND k."id" < p."id"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "TherapyRelation_active_pair_key"
  ON "TherapyRelation" ("therapistId", "clientId")
  WHERE "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "Pair_active_users_key"
  ON "Pair" (LEAST("userId1", "userId2"), GREATEST("userId1", "userId2"))
  WHERE "status" = 'active' AND "userId2" IS NOT NULL;
