CREATE TABLE "UserBeliefCheck" (
  "id"              SERIAL PRIMARY KEY,
  "userId"          BIGINT NOT NULL,
  "belief"          TEXT NOT NULL,
  "evidenceFor"     TEXT NOT NULL,
  "evidenceAgainst" TEXT NOT NULL,
  "reframe"         TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBeliefCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "UserBeliefCheck_userId_createdAt_idx" ON "UserBeliefCheck"("userId", "createdAt");

CREATE TABLE "UserLetter" (
  "id"        SERIAL PRIMARY KEY,
  "userId"    BIGINT NOT NULL,
  "text"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserLetter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "UserLetter_userId_createdAt_idx" ON "UserLetter"("userId", "createdAt");

CREATE TABLE "UserSafePlace" (
  "userId"      BIGINT PRIMARY KEY,
  "description" TEXT NOT NULL,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSafePlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "UserFlashcard" (
  "id"         SERIAL PRIMARY KEY,
  "userId"     BIGINT NOT NULL,
  "modeId"     TEXT NOT NULL,
  "needId"     TEXT NOT NULL,
  "reflection" TEXT,
  "action"     TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFlashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "UserFlashcard_userId_createdAt_idx" ON "UserFlashcard"("userId", "createdAt");
