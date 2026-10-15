-- Booking.amount: сумма выставленного счёта (рубли) на момент брони.
-- Nullable без DEFAULT и без бэкфилла: значение важно только для HELD-броней
-- (они живут 15 минут), у старых сверка берёт текущую цену.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "amount" INTEGER;
