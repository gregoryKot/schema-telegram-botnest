-- Full migration of remaining localStorage keys into typed columns and tables.

ALTER TABLE "User"
  ADD COLUMN "onboardingV1Done"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "onboardingSkipped"        JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN "hintSheetCloseShown"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hintHistoryDismissed"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trackerOnboardingDone"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastCelebrationDate"      TEXT,
  ADD COLUMN "lastYesterdayBannerDate"  TEXT,
  ADD COLUMN "lastWeeklyQuestionWeek"   TEXT,
  ADD COLUMN "schemaIntrosShown"        JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN "modeIntrosShown"          JSONB   NOT NULL DEFAULT '[]';

-- Backfill from legacy clientState JSON if present
UPDATE "User" SET
  "onboardingV1Done"         = COALESCE(("clientState"->>'onboarding_done')          = '1', false),
  "hintSheetCloseShown"      = COALESCE(("clientState"->>'sheet_close_hint_shown')   = '1', false),
  "hintHistoryDismissed"     = COALESCE(("clientState"->>'history_hint_dismissed')   = '1', false)
WHERE "clientState" <> '{}'::jsonb;

-- Drop the legacy clientState column (no longer used after this migration)
ALTER TABLE "User" DROP COLUMN "clientState";

-- New table: diary drafts (previously stored in localStorage as diary_draft_*)
CREATE TABLE "DiaryDraft" (
  "userId"    BIGINT      NOT NULL,
  "type"      TEXT        NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "data"      JSONB       NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiaryDraft_pkey" PRIMARY KEY ("userId", "type")
);
ALTER TABLE "DiaryDraft"
  ADD CONSTRAINT "DiaryDraft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
