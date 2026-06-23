-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('HELD', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('INTRO_15', 'SESSION_50');

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" SERIAL NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startHour" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL DEFAULT 0,
    "endHour" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL DEFAULT 0,
    "sessionDuration" INTEGER NOT NULL DEFAULT 50,
    "bufferMin" INTEGER NOT NULL DEFAULT 10,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "type" "SessionType" NOT NULL DEFAULT 'SESSION_50',
    "status" "BookingStatus" NOT NULL DEFAULT 'HELD',
    "heldUntil" TIMESTAMP(3),
    "clientName" TEXT NOT NULL,
    "clientContact" TEXT NOT NULL,
    "message" TEXT,
    "clientTelegramId" BIGINT,
    "cancelToken" TEXT NOT NULL,
    "meetingUrl" TEXT,
    "calDavUid" TEXT,
    "reminder24SentAt" TIMESTAMP(3),
    "reminder2SentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_cancelToken_key" ON "Booking"("cancelToken");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_calDavUid_key" ON "Booking"("calDavUid");

-- CreateIndex
CREATE INDEX "Booking_startsAt_status_idx" ON "Booking"("startsAt", "status");

-- CreateIndex
CREATE INDEX "Booking_heldUntil_status_idx" ON "Booking"("heldUntil", "status");
