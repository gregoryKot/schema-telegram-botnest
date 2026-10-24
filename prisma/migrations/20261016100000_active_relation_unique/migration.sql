-- «Одна активная связь на пару» (аудит 2026-10, слияние аккаунтов плодило дубли):
-- до сих пор инвариант жил только в `findFirst → alreadyConnected`, а уникальности
-- в базе не было. Дубли получались двумя путями: слияние аккаунтов (ремап
-- therapistId/clientId и userId1/userId2 без дедупа) и гонка двух приглашений;
-- у Pair — ещё и «B вступил по коду A, затем A по коду B» (две строки (A,B) и (B,A)).
-- Клиент у терапевта и партнёр у друга показывались дважды.
--
-- 1. Дедуп существующих дублей (иначе CREATE UNIQUE INDEX упадёт, получим P3009 и
--    крашлуп прода, инцидент 2026-07-16). Остаётся строка с минимальным id.
--    TherapyRelation: лишняя НЕ удаляется, а завершается (`ended`) — заметки и
--    карты ключуются по (therapistId, clientId), а не по id связи. Виртуальные
--    клиенты (clientId IS NULL) не дубли друг друга. Перед завершением имя
--    клиента, даты и дни встреч лишних строк доливаются в остающуюся там, где у
--    неё пусто (политика merge, src/auth/merge-relations.ts): ended-строку
--    терапевт в списке не видит, и имя, данное клиенту в дубле, пропало бы с экрана.
--    Pair: лишняя удаляется — кроме code и createdAt в ней данных нет, а
--    getUserPairs отдаёт все статусы, так что `ended`-дубль остался бы в списке.
-- 2. Частичные уникальные индексы. Только по active: pending/ended историю не
--    ограничивают. Обычный CREATE INDEX, не CONCURRENTLY (миграция в транзакции).
-- Идемпотентно: повторный прогон не находит дублей, индексы IF NOT EXISTS.

-- array_agg по возрастанию id начинается с остающейся строки: её непустое
-- значение побеждает, пустое берётся из самого раннего дубля, где оно есть.
WITH dup AS (
  SELECT
    min("id") AS keep,
    (array_agg("clientAlias" ORDER BY "id") FILTER (WHERE "clientAlias" IS NOT NULL))[1] AS alias,
    (array_agg("therapyStartDate" ORDER BY "id") FILTER (WHERE "therapyStartDate" IS NOT NULL))[1] AS start_date,
    (array_agg("nextSession" ORDER BY "id") FILTER (WHERE "nextSession" IS NOT NULL))[1] AS next_session,
    (array_agg("meetingDays" ORDER BY "id") FILTER (WHERE "meetingDays" <> '[]'::jsonb))[1] AS days
  FROM "TherapyRelation"
  WHERE "status" = 'active' AND "clientId" IS NOT NULL
  GROUP BY "therapistId", "clientId"
  HAVING count(*) > 1
)
UPDATE "TherapyRelation" r
SET "clientAlias" = dup.alias,
    "therapyStartDate" = dup.start_date,
    "nextSession" = dup.next_session,
    "meetingDays" = COALESCE(dup.days, r."meetingDays")
FROM dup
WHERE r."id" = dup.keep;

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
