-- Колесо потребностей клиента переезжает из карты в концептуализацию: одно
-- колесо на клиента — ConceptNeedLink[] (по каждой из пяти потребностей оценка
-- 0–10 и заметка за детство, подростковый возраст и сейчас).
-- Хранится зашифрованным JSON, как modeLinks/schemaLinks (encryptJson).
-- Идемпотентно: повторный прогон после падения посередине ничего не ломает.
ALTER TABLE "ClientConceptualization" ADD COLUMN IF NOT EXISTS "needLinks" JSONB NOT NULL DEFAULT '[]';
