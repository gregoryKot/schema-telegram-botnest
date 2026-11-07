-- Постоянный код адреса карточки клиента в кабинете терапевта:
-- /cabinet/<urlCode> вместо числового id (владелец, 2026-11-06). Числовой id
-- офлайн-клиента (-TherapyRelation.id) менялся, когда карточку подключали к
-- аккаунту клиента, и сохранённая ссылка вела в никуда.
-- Код — 8 букв без цифр (цифры uuid переведены в буквы): со старым числовым
-- адресом не путается. Дефолт волатильный, поэтому при добавлении колонки
-- Postgres считает его для каждой существующей строки отдельно.
-- Идемпотентно: колонка и индекс — IF NOT EXISTS, развод дублей на повторе
-- ничего не находит.
ALTER TABLE "TherapyRelation"
  ADD COLUMN IF NOT EXISTS "urlCode" TEXT NOT NULL
  DEFAULT translate(left(gen_random_uuid()::text, 8), '0123456789', 'ghjkmnpqrs');

-- Совпадение кодов у двух строк маловероятно (16^8 вариантов), но уникальный
-- индекс ниже на нём упал бы и уронил деплой: разводим, пока дублей нет.
DO $$
BEGIN
  LOOP
    UPDATE "TherapyRelation"
    SET "urlCode" = translate(left(gen_random_uuid()::text, 8), '0123456789', 'ghjkmnpqrs')
    WHERE id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY "urlCode" ORDER BY id) AS rn
        FROM "TherapyRelation"
      ) d
      WHERE d.rn > 1
    );
    EXIT WHEN NOT FOUND;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TherapyRelation_urlCode_key" ON "TherapyRelation"("urlCode");
