-- Therapist request flow — replaces the shared THERAPIST_CODE secret with
-- per-user requests reviewed by the admin via the Telegram bot.
CREATE TABLE "TherapistRequest" (
  "id"            SERIAL PRIMARY KEY,
  "userId"        BIGINT NOT NULL UNIQUE,
  "fullName"      TEXT NOT NULL,
  "qualification" TEXT NOT NULL,
  "contacts"      TEXT NOT NULL,
  "message"       TEXT,
  "status"        TEXT NOT NULL DEFAULT 'pending',
  "reviewedAt"    TIMESTAMP(3),
  "reviewedBy"    BIGINT,
  "rejectReason"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL
);

CREATE INDEX "TherapistRequest_status_idx" ON "TherapistRequest"("status");

ALTER TABLE "TherapistRequest"
  ADD CONSTRAINT "TherapistRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
