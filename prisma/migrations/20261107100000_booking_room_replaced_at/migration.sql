-- Признак «проход подтверждения заменил постоянную комнату клиента» (аудит
-- 2026-10): runConfirmEffects (src/booking/booking-confirm-run.ts) держал его
-- только в локальной переменной, и повтор после падения (крон-добор, повтор
-- вебхука) слал владельцу DM без строки «комната клиента заменена». Пишется
-- вместе с meetingUrl. Колонка nullable без DEFAULT, старые строки — NULL
-- («не заменяли»); миграция идемпотентна целиком.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "roomReplacedAt" TIMESTAMP(3);
