-- Кому бот показал карточку сверки входа/привязки (сырой telegramId).
-- Nullable: старые билеты живут 5 минут, backfill не нужен.
ALTER TABLE "LoginTicket" ADD COLUMN "shownToTelegramId" BIGINT;
