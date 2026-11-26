-- CreateTable: TherapyRelation
CREATE TABLE "TherapyRelation" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "therapistId" BIGINT NOT NULL,
    "clientId" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TherapyRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserTask
CREATE TABLE "UserTask" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "assignedBy" BIGINT,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "targetDays" INTEGER,
    "needId" TEXT,
    "dueDate" TEXT,
    "done" BOOLEAN,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TherapyRelation_code_key" ON "TherapyRelation"("code");

-- CreateIndex
CREATE INDEX "UserTask_userId_done_createdAt_idx" ON "UserTask"("userId", "done", "createdAt");

-- AddForeignKey
ALTER TABLE "TherapyRelation" ADD CONSTRAINT "TherapyRelation_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapyRelation" ADD CONSTRAINT "TherapyRelation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
