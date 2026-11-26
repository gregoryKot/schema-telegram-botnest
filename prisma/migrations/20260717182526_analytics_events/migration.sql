-- Продуктовая аналитика (правило №8): таблица событий.
-- Идемпотентно (IF NOT EXISTS + guard на constraint) — правило миграций №3.
-- Инцидент 2026-07-18: исходная версия делала CREATE TABLE/INDEX/ADD CONSTRAINT
-- без IF NOT EXISTS; на проде таблица уже существовала (заведена вне migrate),
-- поэтому `migrate deploy` падал 42P07 → P3009 → крашлуп старта. Переписано
-- идемпотентно: безопасно и на чистой БД, и когда объекты уже есть.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- AddForeignKey (guarded: pg_constraint не поддерживает IF NOT EXISTS для ADD)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AnalyticsEvent_userId_fkey'
  ) THEN
    ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
