-- Ручной слой поверх недельных AvailabilityRule для календаря слотов в
-- админке: BLOCK закрывает время, которое иначе открыто правилом (или
-- встречей внешнего календаря при выключенной блокировке), OPEN открывает
-- разовый слот вне недельных правил. startsAt @unique — BLOCK и OPEN на
-- одну ячейку не могут сосуществовать по построению.

-- CreateEnum
CREATE TYPE "SlotOverrideKind" AS ENUM ('BLOCK', 'OPEN');

-- CreateTable
CREATE TABLE "SlotOverride" (
    "id" SERIAL NOT NULL,
    "kind" "SlotOverrideKind" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlotOverride_startsAt_key" ON "SlotOverride"("startsAt");
