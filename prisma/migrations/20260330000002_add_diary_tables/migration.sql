-- CreateTable
CREATE TABLE "SchemaDiaryEntry" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" TEXT NOT NULL,
    "emotions" JSONB NOT NULL,
    "thoughts" TEXT,
    "bodyFeelings" TEXT,
    "actualBehavior" TEXT,
    "schemaIds" JSONB NOT NULL,
    "schemaOrigin" TEXT,
    "healthyView" TEXT,
    "realProblems" TEXT,
    "excessiveReactions" TEXT,
    "healthyBehavior" TEXT,
    CONSTRAINT "SchemaDiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeDiaryEntry" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modeId" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "thoughts" TEXT,
    "feelings" TEXT,
    "bodyFeelings" TEXT,
    "actions" TEXT,
    "actualNeed" TEXT,
    "childhoodMemories" TEXT,
    CONSTRAINT "ModeDiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GratitudeDiaryEntry" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "date" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GratitudeDiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchemaDiaryEntry_userId_createdAt_idx" ON "SchemaDiaryEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ModeDiaryEntry_userId_createdAt_idx" ON "ModeDiaryEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GratitudeDiaryEntry_userId_date_key" ON "GratitudeDiaryEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "GratitudeDiaryEntry_userId_idx" ON "GratitudeDiaryEntry"("userId");
