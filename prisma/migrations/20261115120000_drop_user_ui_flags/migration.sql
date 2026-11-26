-- UI-флаги мини-аппа без писателя с удаления POST /api/user-flags; данных людей в них нет, только состояние интерфейса.
ALTER TABLE "User" DROP COLUMN IF EXISTS "themePref";
ALTER TABLE "User" DROP COLUMN IF EXISTS "onboardingV1Done";
ALTER TABLE "User" DROP COLUMN IF EXISTS "onboardingSkipped";
ALTER TABLE "User" DROP COLUMN IF EXISTS "childhoodWheelDone";
ALTER TABLE "User" DROP COLUMN IF EXISTS "ysqBannerDismissed";
ALTER TABLE "User" DROP COLUMN IF EXISTS "hintSheetCloseShown";
ALTER TABLE "User" DROP COLUMN IF EXISTS "hintHistoryDismissed";
ALTER TABLE "User" DROP COLUMN IF EXISTS "trackerOnboardingDone";
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastCelebrationDate";
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastYesterdayBannerDate";
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastWeeklyQuestionWeek";
ALTER TABLE "User" DROP COLUMN IF EXISTS "schemaIntrosShown";
ALTER TABLE "User" DROP COLUMN IF EXISTS "modeIntrosShown";
ALTER TABLE "User" DROP COLUMN IF EXISTS "defaultSection";
