-- Валюта брони: цена сессии зависит от страны посетителя (решение владельца
-- 2026-10-20): Россия — рубли, Израиль — шекели, остальная Европа — евро,
-- остальной мир — доллары. У старых строк — рубли. Идемпотентно.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'RUB';

-- Цена сессии в рублях — 4 000 ₽ (решение владельца 2026-10-20). Живая цена
-- хранится в BookingSetting и сильнее дефолта из кода (как в миграции
-- 20261001090000_session_price_3000), поэтому одной правки дефолта мало.
-- Идемпотентно; updatedAt заполняется явно (у @updatedAt в БД нет DEFAULT).
INSERT INTO "BookingSetting" ("key", "value", "updatedAt")
VALUES ('price:SESSION_50', '4000', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;
