-- CreateTable
CREATE TABLE "CronLease" (
    "name" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "CronLease_pkey" PRIMARY KEY ("name")
);
