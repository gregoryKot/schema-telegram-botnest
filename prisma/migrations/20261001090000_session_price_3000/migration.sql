-- Цена сессии 50 минут — 3 000 ₽ (решение владельца 2026-10-01,
-- docs/CONVERSION_REVIEW_KOTLAREWSKI_2026-09.md). Живая цена хранится в
-- BookingSetting (правится в админке) и сильнее дефолта из booking.config.ts,
-- поэтому одной правки дефолта мало — upsert. Идемпотентно; updatedAt
-- заполняется явно (у @updatedAt в БД нет DEFAULT).
INSERT INTO "BookingSetting" ("key", "value", "updatedAt")
VALUES ('price:SESSION_50', '3000', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;
