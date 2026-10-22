-- Retention of booking PII (audit 2026-07-20, finding L3; owner decision
-- 2026-10-08: anonymise after 12 months). A booking row has no link to an
-- account, so it survives account deletion with an encrypted name, contact and
-- request text. The nightly cron (booking-retention.service.ts) blanks those
-- three columns for sessions older than 12 months; the booking itself (date,
-- type, offer acceptance) stays. This column marks a row as already
-- anonymised, so the cron does not pick it up again.
ALTER TABLE "Booking" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
