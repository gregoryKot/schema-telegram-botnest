-- CreateTable
CREATE TABLE IF NOT EXISTS "IntroLead" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientName" TEXT NOT NULL,
    "clientContact" TEXT NOT NULL,
    "message" TEXT,
    "clientChannel" TEXT,
    "source" TEXT,
    "tgDeliveredAt" TIMESTAMP(3),
    "emailDeliveredAt" TIMESTAMP(3),
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "anonymizedAt" TIMESTAMP(3),

    CONSTRAINT "IntroLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntroLead_createdAt_idx" ON "IntroLead"("createdAt");
