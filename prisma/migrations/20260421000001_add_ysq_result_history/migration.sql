-- CreateTable: YsqResultHistory — stores all historical YSQ test results per user
CREATE TABLE IF NOT EXISTS "YsqResultHistory" (
    "id"          SERIAL PRIMARY KEY,
    "userId"      BIGINT NOT NULL,
    "answers"     JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YsqResultHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "YsqResultHistory_userId_completedAt_idx" ON "YsqResultHistory"("userId", "completedAt");
