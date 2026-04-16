-- AddColumn: therapistShareCards and therapistShareProfile on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "therapistShareCards" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "therapistShareProfile" BOOLEAN NOT NULL DEFAULT true;
