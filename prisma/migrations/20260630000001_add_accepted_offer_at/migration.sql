-- Legal: record when the client accepted the public offer (consent checkbox).
ALTER TABLE "Booking" ADD COLUMN "acceptedOfferAt" TIMESTAMP(3);
