-- CreateTable
CREATE TABLE "ThrottleHit" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),

    CONSTRAINT "ThrottleHit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ThrottleHit_expiresAt_idx" ON "ThrottleHit"("expiresAt");
