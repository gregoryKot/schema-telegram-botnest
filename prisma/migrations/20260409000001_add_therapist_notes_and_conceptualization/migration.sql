-- CreateTable: TherapistNote
CREATE TABLE "TherapistNote" (
    "id" SERIAL NOT NULL,
    "therapistId" BIGINT NOT NULL,
    "clientId" BIGINT NOT NULL,
    "date" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TherapistNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TherapistNote_therapistId_clientId_createdAt_idx" ON "TherapistNote"("therapistId", "clientId", "createdAt");

-- CreateTable: ClientConceptualization
CREATE TABLE "ClientConceptualization" (
    "id" SERIAL NOT NULL,
    "therapistId" BIGINT NOT NULL,
    "clientId" BIGINT NOT NULL,
    "schemaIds" JSONB NOT NULL DEFAULT '[]',
    "modeIds" JSONB NOT NULL DEFAULT '[]',
    "earlyExperience" TEXT,
    "unmetNeeds" TEXT,
    "triggers" TEXT,
    "copingStyles" TEXT,
    "goals" TEXT,
    "currentProblems" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientConceptualization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientConceptualization_therapistId_clientId_key" ON "ClientConceptualization"("therapistId", "clientId");
