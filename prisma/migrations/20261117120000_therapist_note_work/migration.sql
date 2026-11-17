-- «Что делали» в итогах сессии: пункты заметки терапевта, шифруются целиком как связи концептуализации.
ALTER TABLE "TherapistNote" ADD COLUMN IF NOT EXISTS "work" JSONB NOT NULL DEFAULT '[]';
