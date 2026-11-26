-- Map kind: 'personality' (whole-person overview) vs 'problem' (specific cycle)
ALTER TABLE "ModeMap" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'problem';
