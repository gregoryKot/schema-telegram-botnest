-- Графическая концептуализация (модель режимов): связи режимов клиента —
-- ConceptModeLink[] (схемы, потребности, истоки, проявления, работа в терапии).
-- Хранится зашифрованным JSON, как modeMapNodes/modeMapEdges (encryptJson).
-- Идемпотентно: повторный прогон после падения посередине ничего не ломает.
ALTER TABLE "ClientConceptualization" ADD COLUMN IF NOT EXISTS "modeLinks" JSONB NOT NULL DEFAULT '[]';
