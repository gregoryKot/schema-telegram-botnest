-- «Повторы недели»: тумблер еженедельного уведомления, по умолчанию включён.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyWeeklyRepeatEnabled" BOOLEAN NOT NULL DEFAULT true;
