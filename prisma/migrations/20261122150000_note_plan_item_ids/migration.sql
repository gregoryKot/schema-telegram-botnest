-- Итоги сессии ↔ пункты плана, над которыми работали (без FK, как clientId).
ALTER TABLE "TherapistNote" ADD COLUMN IF NOT EXISTS "planItemIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
