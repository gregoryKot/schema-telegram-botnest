-- Therapist's personal custom mode library (global across all clients)
CREATE TABLE "TherapistCustomMode" (
  "id"          SERIAL PRIMARY KEY,
  "therapistId" BIGINT NOT NULL,
  "name"        TEXT NOT NULL,
  "emoji"       TEXT NOT NULL DEFAULT '⬡',
  "nodeType"    TEXT NOT NULL DEFAULT 'custom',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "TherapistCustomMode_therapistId_createdAt_idx"
  ON "TherapistCustomMode"("therapistId", "createdAt");
