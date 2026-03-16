ALTER TABLE "ScheduledNotification" DROP CONSTRAINT "ScheduledNotification_userId_fkey";

ALTER TABLE "User" ALTER COLUMN "id" TYPE BIGINT;
ALTER TABLE "Rating" ALTER COLUMN "userId" TYPE BIGINT;
ALTER TABLE "ScheduledNotification" ALTER COLUMN "userId" TYPE BIGINT;

ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
