-- AlterTable TherapyRelation: add session scheduling fields
ALTER TABLE "TherapyRelation" ADD COLUMN "nextSession" TEXT;
ALTER TABLE "TherapyRelation" ADD COLUMN "meetingDays" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "TherapyRelation" ADD COLUMN "therapyStartDate" TEXT;

-- AlterTable ClientConceptualization: add mode transitions field
ALTER TABLE "ClientConceptualization" ADD COLUMN "modeTransitions" TEXT;
