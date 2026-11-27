-- Согласие на обработку ПДн (152-ФЗ ст.9): когда дано и какая редакция текста. Без бэкафилла: у прежних согласий null.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disclaimerAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "consentVersion" TEXT;
