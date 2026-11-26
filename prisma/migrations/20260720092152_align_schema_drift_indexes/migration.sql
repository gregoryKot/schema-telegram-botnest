-- Выравнивание дрейфа schema.prisma ↔ migrations (существовал на origin/main,
-- к фичам не привязан). Эти 4 индекса были объявлены в схеме, но их не
-- создавала ни одна миграция — значит на проде их не было, и горячие пути
-- (рейтинги, задачи, списки клиентов терапевта) шли последовательным сканом.
--
-- Почему обычный CREATE INDEX, а не CONCURRENTLY: CONCURRENTLY здесь технически
-- проходит (Prisma НЕ оборачивает файл миграции в транзакцию — проверено), но он
-- нетранзакционный и при сбое оставляет INVALID-индекс + failed-миграцию →
-- P3009 → блокировка всех миграций → крашлуп прода (инцидент 2026-07-16).
-- Обычный CREATE INDEX транзакционный: падает чисто и откатывается целиком.
-- Блокировка на запись на этих объёмах — миллисекунды, что дешевле риска
-- заблокированных миграций.
--
-- IF NOT EXISTS — идемпотентность (правило №3 «Миграции БД»): повторный прогон
-- после отката/сбоя безопасен.

CREATE INDEX IF NOT EXISTS "Rating_userId_date_idx"
  ON "Rating"("userId", "date");

CREATE INDEX IF NOT EXISTS "TherapyRelation_therapistId_status_idx"
  ON "TherapyRelation"("therapistId", "status");

CREATE INDEX IF NOT EXISTS "TherapyRelation_clientId_status_idx"
  ON "TherapyRelation"("clientId", "status");

CREATE INDEX IF NOT EXISTS "UserTask_userId_done_type_idx"
  ON "UserTask"("userId", "done", "type");
