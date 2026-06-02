-- Named mode maps: multiple per therapist+client pair.
-- nodes/edges are encrypted JSON (same pattern as ClientConceptualization).
CREATE TABLE "ModeMap" (
  "id"          SERIAL PRIMARY KEY,
  "therapistId" BIGINT NOT NULL,
  "clientId"    BIGINT NOT NULL,
  "title"       TEXT NOT NULL DEFAULT 'Карта режимов',
  "nodes"       JSONB NOT NULL DEFAULT '[]',
  "edges"       JSONB NOT NULL DEFAULT '[]',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ModeMap_therapistId_clientId_createdAt_idx"
  ON "ModeMap"("therapistId", "clientId", "createdAt");
