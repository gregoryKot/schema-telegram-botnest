-- Opt-in игровой режим уведомлений: серия с 1 дня + подсветка ближайшей вехи.
ALTER TABLE "User" ADD COLUMN "notifyGamified" BOOLEAN NOT NULL DEFAULT false;
