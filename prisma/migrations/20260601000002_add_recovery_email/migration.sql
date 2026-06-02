-- Recovery email + one-use magic-link tokens.
ALTER TABLE "User"
  ADD COLUMN "recoveryEmail"           TEXT UNIQUE,
  ADD COLUMN "recoveryEmailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "EmailToken" (
  "id"        TEXT PRIMARY KEY,
  "userId"    BIGINT,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "email"     TEXT NOT NULL,
  "purpose"   TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "EmailToken_userId_idx" ON "EmailToken"("userId");
CREATE INDEX "EmailToken_expiresAt_idx" ON "EmailToken"("expiresAt");
