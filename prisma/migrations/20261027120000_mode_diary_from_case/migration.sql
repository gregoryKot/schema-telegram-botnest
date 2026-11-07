-- Маркер «запись родилась из потока „Что случилось“» (простой клиент, этап 4):
-- «Записи» строят по нему фильтр «Случаи», /stats считает разборы. Старые записи
-- остаются false — разбор до этой даты в данных неотличим от записи режима.
-- Булево, не текст: шифрование не нужно. Идемпотентно целиком.
ALTER TABLE "ModeDiaryEntry" ADD COLUMN IF NOT EXISTS "fromCase" BOOLEAN NOT NULL DEFAULT false;
-- /stats считает разборы за 30 дней (fromCase = true AND createdAt >= since):
-- без индекса гейт планов (check-query-plans, сценарий stats-report) видит
-- Seq Scan по всей таблице. Обычный CREATE INDEX, не CONCURRENTLY (правило №28).
CREATE INDEX IF NOT EXISTS "ModeDiaryEntry_fromCase_createdAt_idx" ON "ModeDiaryEntry"("fromCase", "createdAt");
