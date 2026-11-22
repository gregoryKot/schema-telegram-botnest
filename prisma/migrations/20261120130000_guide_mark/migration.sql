-- Отметки «Про клиента» из «Справочника» (#1484): note и snapshot шифруются приложением.
CREATE TABLE IF NOT EXISTS "GuideMark" (
    "id" SERIAL NOT NULL,
    "therapistId" BIGINT NOT NULL,
    "clientId" BIGINT NOT NULL,
    "address" TEXT NOT NULL,
    "note" TEXT,
    "snapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideMark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuideMark_therapistId_clientId_address_key" ON "GuideMark"("therapistId", "clientId", "address");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuideMark_therapistId_fkey') THEN
    ALTER TABLE "GuideMark" ADD CONSTRAINT "GuideMark_therapistId_fkey"
      FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
