-- «В план» на адресах справочника (#1484): адрес раздела вместо вида/id/поля.
-- Перевод старого источника — тот же, что legacyPlanSourceAddress (shared/src/therapy/plan/planAddress.ts).
-- Старые колонки остаются: не переводимое в адрес не теряется.
ALTER TABLE "TherapyPlanItem" ADD COLUMN IF NOT EXISTS "sourceAddress" TEXT;

UPDATE "TherapyPlanItem"
SET "sourceAddress" = "sourceKind" || ':' || "sourceId" || '/' || "sourceField"
WHERE "sourceAddress" IS NULL
  AND "sourceKind" IN ('schema', 'mode', 'technique')
  AND "sourceId" ~ '^[A-Za-z0-9_-]+$'
  AND "sourceField" ~ '^[A-Za-z][A-Za-z0-9_]*$';
