-- CreateTable
CREATE TABLE "BookingSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSetting_pkey" PRIMARY KEY ("key")
);
