-- Терапевт показывает клиенту схему случая (тумблер «Показать клиенту» во
-- вкладке «Концептуализация»): момент, когда показал; NULL — схема клиенту не
-- видна. Клиент получает только вид «Схема» без истоков и задач терапии
-- (src/therapy/client-concept-view.ts). Колонка nullable без DEFAULT —
-- существующие концептуализации остаются скрытыми. Идемпотентно целиком.
ALTER TABLE "ClientConceptualization" ADD COLUMN IF NOT EXISTS "sharedWithClientAt" TIMESTAMP(3);
