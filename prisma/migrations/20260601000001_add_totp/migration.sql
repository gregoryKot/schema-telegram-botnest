-- 2FA (TOTP, RFC 6238) — optional per-user.
-- All secrets/recovery codes stored encrypted (AES-256-GCM via ENCRYPTION_KEY).
ALTER TABLE "User"
  ADD COLUMN "totpSecret"        TEXT,
  ADD COLUMN "totpEnabledAt"     TIMESTAMP(3),
  ADD COLUMN "totpRecoveryCodes" JSONB NOT NULL DEFAULT '[]';
