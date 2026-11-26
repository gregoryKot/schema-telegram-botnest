-- Replace fixed UTC offsets with IANA timezone names so DST is handled automatically.
-- notifyLocalHour = the hour the user wants in their local time (was computed from utcHour + offset).
-- notifyTimezone  = IANA timezone name (e.g. "Europe/Kyiv"), offset computed dynamically at send time.

ALTER TABLE "User" ADD COLUMN "notifyLocalHour" INTEGER NOT NULL DEFAULT 21;
ALTER TABLE "User" ADD COLUMN "notifyTimezone"  TEXT    NOT NULL DEFAULT 'Europe/Moscow';

-- Migrate existing data: local hour = (utcHour + tzOffset) mod 24
UPDATE "User"
SET "notifyLocalHour" = (("notifyUtcHour" + "notifyTzOffset") % 24 + 24) % 24;

-- Map integer UTC offset -> IANA timezone name
UPDATE "User"
SET "notifyTimezone" = CASE "notifyTzOffset"
  WHEN -8 THEN 'America/Los_Angeles'
  WHEN -5 THEN 'America/New_York'
  WHEN  0 THEN 'Europe/London'
  WHEN  1 THEN 'Europe/Berlin'
  WHEN  2 THEN 'Europe/Kyiv'
  WHEN  3 THEN 'Europe/Moscow'
  WHEN  4 THEN 'Asia/Dubai'
  WHEN  5 THEN 'Asia/Tashkent'
  WHEN  6 THEN 'Asia/Almaty'
  WHEN  8 THEN 'Asia/Shanghai'
  ELSE 'UTC'
END;

ALTER TABLE "User" DROP COLUMN "notifyUtcHour";
ALTER TABLE "User" DROP COLUMN "notifyTzOffset";
