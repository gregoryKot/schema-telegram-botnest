-- Приглашение из карточки офлайн-клиента (TherapyRelation.attachToId): строка
-- pending помнит id офлайн-строки, чьи данные (задания, заметки, карты режимов,
-- концептуализация) переезжают на аккаунт клиента при подключении
-- (src/therapy/therapy-invite-attach.ts). Удаление офлайн-строки каскадом
-- отзывает её приглашения. Колонка nullable без DEFAULT; идемпотентно целиком.
ALTER TABLE "TherapyRelation" ADD COLUMN IF NOT EXISTS "attachToId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TherapyRelation_attachToId_fkey'
  ) THEN
    ALTER TABLE "TherapyRelation"
      ADD CONSTRAINT "TherapyRelation_attachToId_fkey"
      FOREIGN KEY ("attachToId") REFERENCES "TherapyRelation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Индекс по FK: каскад при удалении карточки и поиск её живого приглашения
-- (therapy-invite-from-card.ts). Обычный CREATE INDEX, не CONCURRENTLY
-- (правило №28: внутри миграции CONCURRENTLY падает и оставляет P3009).
CREATE INDEX IF NOT EXISTS "TherapyRelation_attachToId_idx"
  ON "TherapyRelation"("attachToId");
