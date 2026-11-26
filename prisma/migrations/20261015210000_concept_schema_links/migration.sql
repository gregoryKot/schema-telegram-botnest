-- Графическая концептуализация (модель режимов): тексты схем клиента —
-- ConceptSchemaLink[] (убеждение, детский опыт, блокируемые потребности).
-- Хранится зашифрованным JSON, как modeLinks/modeMapNodes (encryptJson).
-- Идемпотентно: повторный прогон после падения посередине ничего не ломает.
ALTER TABLE "ClientConceptualization" ADD COLUMN IF NOT EXISTS "schemaLinks" JSONB NOT NULL DEFAULT '[]';
