-- Add onDelete Cascade to Note, ScheduledNotification, Pair
ALTER TABLE "Note" DROP CONSTRAINT "Note_userId_fkey";
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduledNotification" DROP CONSTRAINT "ScheduledNotification_userId_fkey";
ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pair" DROP CONSTRAINT "Pair_userId1_fkey";
ALTER TABLE "Pair" ADD CONSTRAINT "Pair_userId1_fkey" FOREIGN KEY ("userId1") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pair" DROP CONSTRAINT "Pair_userId2_fkey";
ALTER TABLE "Pair" ADD CONSTRAINT "Pair_userId2_fkey" FOREIGN KEY ("userId2") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
