-- План работы с клиентом: пункты терапевта (текст шифруется приложением).
CREATE TABLE IF NOT EXISTS "TherapyPlanItem" (
    "id" SERIAL NOT NULL,
    "therapistId" BIGINT NOT NULL,
    "clientId" BIGINT NOT NULL,
    "rubric" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "position" INTEGER NOT NULL DEFAULT 0,
    "sourceKind" TEXT,
    "sourceId" TEXT,
    "sourceField" TEXT,
    "taskId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TherapyPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TherapyPlanItem_therapistId_clientId_position_idx" ON "TherapyPlanItem"("therapistId", "clientId", "position");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TherapyPlanItem_taskId_fkey') THEN
    ALTER TABLE "TherapyPlanItem" ADD CONSTRAINT "TherapyPlanItem_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "UserTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
