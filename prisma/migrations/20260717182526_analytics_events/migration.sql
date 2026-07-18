-- Продуктовая аналитика (правило №8): таблица событий.
-- ВАЖНО: миграция содержит ТОЛЬКО создание новой таблицы AnalyticsEvent.
-- `prisma migrate dev` дополнительно предложил свернуть сюда накопившийся
-- дрейф схемы (недостающие миграции индексов Rating/TherapyRelation/UserTask,
-- пересоздание FK, снятие DEFAULT с updatedAt в ModeMap/UserSafePlace) — он
-- НЕ относится к этой фиче и опасен: если объекты уже есть на проде (db push),
-- CREATE INDEX без IF NOT EXISTS уронит deploy (риск P3009). Дрейф оставлен
-- как есть — это отдельная, до-существующая проблема.

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
