-- Booking.paidAt: when Robokassa's ResultURL webhook confirmed the payment
-- (signature and amount verified). Status alone could not say "money received":
-- a payment arriving after the hold expired or the client cancelled left the
-- booking CANCELLED with no trace of the money (global audit 2026-10-11).
-- Nullable, no default: existing rows stay NULL (their payment, if any, was
-- not recorded); free intro calls and admin-confirmed bookings stay NULL too.
ALTER TABLE "Booking" ADD COLUMN "paidAt" TIMESTAMP(3);
