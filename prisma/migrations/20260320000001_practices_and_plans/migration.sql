-- CreateTable
CREATE TABLE "UserPractice" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "needId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPractice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticePlan" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "needId" TEXT NOT NULL,
    "practiceText" TEXT NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "reminderUtcHour" INTEGER,
    "done" BOOLEAN,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPractice_userId_needId_idx" ON "UserPractice"("userId", "needId");

-- CreateIndex
CREATE INDEX "PracticePlan_userId_scheduledDate_idx" ON "PracticePlan"("userId", "scheduledDate");
