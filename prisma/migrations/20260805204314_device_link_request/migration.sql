-- CreateTable
CREATE TABLE "DeviceLinkRequest" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "userCodeHash" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedUserId" BIGINT,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceLinkRequest_deviceCodeHash_key" ON "DeviceLinkRequest"("deviceCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceLinkRequest_userCodeHash_key" ON "DeviceLinkRequest"("userCodeHash");

-- CreateIndex
CREATE INDEX "DeviceLinkRequest_userId_idx" ON "DeviceLinkRequest"("userId");

-- CreateIndex
CREATE INDEX "DeviceLinkRequest_expiresAt_idx" ON "DeviceLinkRequest"("expiresAt");

-- AddForeignKey
ALTER TABLE "DeviceLinkRequest" ADD CONSTRAINT "DeviceLinkRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
