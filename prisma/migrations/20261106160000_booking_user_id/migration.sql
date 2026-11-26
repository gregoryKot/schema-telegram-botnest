-- Запись клиента из приложения (issue #546): бронь знает аккаунт клиента,
-- который записался сам из «Мой терапевт» (src/booking/client-booking.service.ts).
-- Публичная форма записи без входа колонку не пишет (C-9). Удаление аккаунта
-- отвязывает бронь (ON DELETE SET NULL + явный updateMany в account.delete.ts):
-- бронь — финансовая и календарная запись, её имя и контакт стирает ретенция
-- по сроку (booking-retention.service.ts). Колонка nullable без DEFAULT;
-- миграция идемпотентна целиком.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "userId" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Booking_userId_fkey'
  ) THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Индекс по FK и под выборку «мои ближайшие брони» (userId + startsAt).
-- Обычный CREATE INDEX, не CONCURRENTLY (правило №28).
CREATE INDEX IF NOT EXISTS "Booking_userId_startsAt_idx"
  ON "Booking"("userId", "startsAt");
