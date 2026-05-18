-- AlterTable: typed UI flags previously stored in localStorage / clientState JSON
ALTER TABLE "User"
  ADD COLUMN "themePref"               TEXT,
  ADD COLUMN "onboardingV2Done"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "practicesOnboardingDone" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "childhoodWheelDone"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ysqBannerDismissed"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "therapistMode"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "defaultSection"          TEXT;

-- Backfill from clientState JSON if those values already exist there
UPDATE "User" SET
  "themePref"               = NULLIF("clientState"->>'theme', ''),
  "onboardingV2Done"        = COALESCE(("clientState"->>'onboarding_v2_done')          = '1', false),
  "practicesOnboardingDone" = COALESCE(("clientState"->>'practices_onboarding_done')   = '1', false),
  "childhoodWheelDone"      = COALESCE(("clientState"->>'childhood_wheel_done')        = '1'
                                    OR ("clientState"->>'childhood_done')              = '1', false),
  "ysqBannerDismissed"      = COALESCE(("clientState"->>'ysq_banner_dismissed')        = '1', false),
  "therapistMode"           = COALESCE(("clientState"->>'therapist_mode')              = '1', false),
  "defaultSection"          = NULLIF("clientState"->>'default_section', '')
WHERE "clientState" <> '{}'::jsonb;

-- Existing THERAPIST users get therapistMode=true (previously auto-enabled client-side)
UPDATE "User" SET "therapistMode" = true WHERE role = 'THERAPIST';
