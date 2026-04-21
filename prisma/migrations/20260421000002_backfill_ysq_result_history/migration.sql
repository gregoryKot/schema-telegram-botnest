-- Backfill: copy existing YsqResult rows into YsqResultHistory for users who
-- completed the test before the history table existed. Only inserts if no
-- history entry exists for that user yet (idempotent).
INSERT INTO "YsqResultHistory" ("userId", "answers", "completedAt")
SELECT "userId", "answers", "completedAt"
FROM "YsqResult"
WHERE NOT EXISTS (
  SELECT 1 FROM "YsqResultHistory" h WHERE h."userId" = "YsqResult"."userId"
);
