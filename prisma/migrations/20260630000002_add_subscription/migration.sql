-- Recurring subscriptions billed via Robokassa.
CREATE TABLE "Subscription" (
  "id"             SERIAL NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "period"         TEXT NOT NULL,
  "amount"         INTEGER NOT NULL,
  "email"          TEXT,
  "telegramId"     BIGINT,
  "firstInvId"     INTEGER,
  "nextChargeAt"   TIMESTAMP(3),
  "lastChargeAt"   TIMESTAMP(3),
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "cancelToken"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_cancelToken_key" ON "Subscription"("cancelToken");
CREATE INDEX "Subscription_status_nextChargeAt_idx" ON "Subscription"("status", "nextChargeAt");

CREATE TABLE "SubscriptionCharge" (
  "id"             SERIAL NOT NULL,
  "subscriptionId" INTEGER NOT NULL,
  "amount"         INTEGER NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "isFirst"        BOOLEAN NOT NULL DEFAULT false,
  "paidAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubscriptionCharge_subscriptionId_idx" ON "SubscriptionCharge"("subscriptionId");
CREATE INDEX "SubscriptionCharge_status_idx" ON "SubscriptionCharge"("status");
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
