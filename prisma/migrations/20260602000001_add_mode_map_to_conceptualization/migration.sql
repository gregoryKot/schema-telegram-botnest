-- Add mode map fields to ClientConceptualization.
-- Nodes and edges are stored as encrypted JSON (encryptJson pattern).
ALTER TABLE "ClientConceptualization"
  ADD COLUMN "modeMapNodes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "modeMapEdges" JSONB NOT NULL DEFAULT '[]';
