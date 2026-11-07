-- Когда и почему связь терапевт↔клиент стала `ended` (решение владельца
-- 2026-10-22): после отказа терапевта от роли клиент видит в приложении
-- сообщение вместо пропавшего «Мой терапевт» (GET /api/therapy/former-therapist),
-- а карты режимов и задания бывшего терапевта остаются у него как история.
-- endReason — машинный код (src/therapy/relation-end-reason.ts), не текст.
-- Обе колонки nullable без DEFAULT. Идемпотентно целиком.
ALTER TABLE "TherapyRelation" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
ALTER TABLE "TherapyRelation" ADD COLUMN IF NOT EXISTS "endReason" VARCHAR(32);

-- Бэкфил причины. `ended` до сих пор ставили двое: отказ от роли
-- (end-therapist-relations.ts и бэкфил 20261014090100 — связи терапевтов, чья
-- роль уже не THERAPIST) и дедуп дублей 20261016100000 — лишняя строка пары
-- при живой основной, терапевт роли не терял. Поэтому причина ставится только
-- там, где терапевт сейчас не THERAPIST: дубль действующего терапевта не
-- превращается в ложное «терапевт больше не работает в приложении». Дата
-- неизвестна — endedAt остаётся NULL. Повторный прогон строк не находит.
UPDATE "TherapyRelation"
SET "endReason" = 'therapist_resigned'
WHERE "status" = 'ended'
  AND "endReason" IS NULL
  AND "therapistId" IN (SELECT "id" FROM "User" WHERE "role" <> 'THERAPIST');
