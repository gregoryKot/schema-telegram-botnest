CREATE TABLE "AppActivity" (
  "id"     SERIAL PRIMARY KEY,
  "userId" BIGINT NOT NULL,
  "date"   TEXT NOT NULL,
  CONSTRAINT "AppActivity_userId_date_key" UNIQUE ("userId", "date")
);
CREATE INDEX "AppActivity_userId_idx" ON "AppActivity"("userId");
