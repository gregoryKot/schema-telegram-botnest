-- «Путь клиента»: путь пары терапевт–клиент и его фазы (текст шифруется приложением).
CREATE TABLE IF NOT EXISTS "TherapyPath" (
    "id" SERIAL NOT NULL,
    "therapistId" BIGINT NOT NULL,
    "clientId" BIGINT NOT NULL,
    "startDate" TEXT NOT NULL,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TherapyPath_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TherapyPath_therapistId_clientId_key" ON "TherapyPath"("therapistId", "clientId");

CREATE TABLE IF NOT EXISTS "TherapyPathPhase" (
    "id" SERIAL NOT NULL,
    "pathId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "weeks" INTEGER NOT NULL,
    "templatePhaseId" TEXT,
    "startedAt" TEXT,
    "endedAt" TEXT,
    "criteriaDone" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TherapyPathPhase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TherapyPathPhase_pathId_position_idx" ON "TherapyPathPhase"("pathId", "position");

ALTER TABLE "TherapyPlanItem" ADD COLUMN IF NOT EXISTS "phaseId" INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TherapyPathPhase_pathId_fkey') THEN
    ALTER TABLE "TherapyPathPhase" ADD CONSTRAINT "TherapyPathPhase_pathId_fkey"
      FOREIGN KEY ("pathId") REFERENCES "TherapyPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TherapyPlanItem_phaseId_fkey') THEN
    ALTER TABLE "TherapyPlanItem" ADD CONSTRAINT "TherapyPlanItem_phaseId_fkey"
      FOREIGN KEY ("phaseId") REFERENCES "TherapyPathPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
