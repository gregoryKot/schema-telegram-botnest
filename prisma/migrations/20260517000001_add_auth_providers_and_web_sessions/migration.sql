-- AuthProvider: links OAuth providers (telegram | google) to a User
CREATE TABLE IF NOT EXISTS "AuthProvider" (
    "id"          SERIAL PRIMARY KEY,
    "userId"      BIGINT NOT NULL,
    "provider"    TEXT NOT NULL,
    "providerId"  TEXT NOT NULL,
    "email"       TEXT,
    "displayName" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthProvider_provider_providerId_key" ON "AuthProvider"("provider", "providerId");
CREATE INDEX IF NOT EXISTS "AuthProvider_userId_idx" ON "AuthProvider"("userId");

-- WebSession: refresh token rotation with theft detection via token families
CREATE TABLE IF NOT EXISTS "WebSession" (
    "id"          TEXT PRIMARY KEY,
    "userId"      BIGINT NOT NULL,
    "tokenHash"   TEXT NOT NULL,
    "family"      TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "revokedAt"   TIMESTAMP(3),
    "ipAddress"   TEXT,
    "userAgent"   TEXT,
    CONSTRAINT "WebSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebSession_tokenHash_key" ON "WebSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "WebSession_userId_revokedAt_idx" ON "WebSession"("userId", "revokedAt");
CREATE INDEX IF NOT EXISTS "WebSession_family_idx" ON "WebSession"("family");
