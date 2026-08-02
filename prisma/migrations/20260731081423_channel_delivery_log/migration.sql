-- CreateTable
CREATE TABLE "ChannelDelivery" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelDelivery_createdAt_idx" ON "ChannelDelivery"("createdAt");
