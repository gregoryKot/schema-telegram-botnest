CREATE TABLE "ScheduledNotification" (
  "id"          SERIAL PRIMARY KEY,
  "userId"      INTEGER NOT NULL,
  "sendAt"      TIMESTAMP(3) NOT NULL,
  "type"        TEXT NOT NULL,
  "payload"     JSONB,
  "sentAt"      TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "ScheduledNotification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ScheduledNotification_sendAt_sentAt_cancelledAt_idx"
  ON "ScheduledNotification"("sendAt", "sentAt", "cancelledAt");

CREATE INDEX "ScheduledNotification_userId_type_sentAt_idx"
  ON "ScheduledNotification"("userId", "type", "sentAt");
