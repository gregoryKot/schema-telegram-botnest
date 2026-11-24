-- «Про клиента»: выделенный фрагмент текста — несколько на адрес (fragmentKey = хэш текста, '' — раздел целиком).
ALTER TABLE "GuideMark" ADD COLUMN IF NOT EXISTS "fragmentKey" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "GuideMark_therapistId_clientId_address_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GuideMark_therapistId_clientId_address_fragmentKey_key"
  ON "GuideMark"("therapistId", "clientId", "address", "fragmentKey");
