-- Record when the subscriber consented to recurring auto-charges.
ALTER TABLE "Subscription" ADD COLUMN "acceptedOfferAt" TIMESTAMP(3);
