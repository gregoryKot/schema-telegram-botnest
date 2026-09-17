import { IsIn, IsObject, IsOptional } from 'class-validator';
import {
  ACCOUNT_LINK_FAIL_REASONS,
  ACCOUNT_LINK_HOSTS,
  ANALYTICS_EVENTS,
  CRISIS_SURFACES,
  CUSTOMIZE_ENTRY_POINTS,
  HOME_SCREEN_ACTIONS,
  HOME_SCREEN_SURFACES,
  ONBOARDING_STEPS,
  TODAY_BLOCKS,
  SHARE_CARD_KINDS,
  TODAY_FOCUS_PRACTICES,
  WEB_BANNER_IDS,
  QUICK_ACTION_IDS,
  QUICK_ACTION_SURFACES,
  QUICK_ACTION_MOVE_DIRS,
  SCREEN_BLOCK_IDS,
  CUSTOMIZABLE_SCREENS,
  SIGNUP_SOURCES,
  PROFILE_PATTERN_KINDS,
} from '../../analytics/analytics.constants';

// DTO для POST /api/event (правило №6: рантайм-валидация декораторами +
// глобальный ValidationPipe whitelist). name — из allow-list; meta — опциональный
// маленький объект без PII. Валидация конкретных полей meta (напр. kind) —
// в сервисе/контроллере по событию, т.к. форма meta зависит от name.
export class TrackEventDto {
  @IsIn(ANALYTICS_EVENTS)
  name!: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

// Допустимые значения meta для санитизации в контроллере (перед записью).
export const SHARE_CARD_KIND_SET: ReadonlySet<string> = new Set(
  SHARE_CARD_KINDS,
);
export const CRISIS_SURFACE_SET: ReadonlySet<string> = new Set(CRISIS_SURFACES);
export const TODAY_FOCUS_PRACTICE_SET: ReadonlySet<string> = new Set(
  TODAY_FOCUS_PRACTICES,
);
export const WEB_BANNER_ID_SET: ReadonlySet<string> = new Set(WEB_BANNER_IDS);
export const ONBOARDING_STEP_SET: ReadonlySet<string> = new Set(
  ONBOARDING_STEPS,
);
export const TODAY_BLOCK_SET: ReadonlySet<string> = new Set(TODAY_BLOCKS);
export const CUSTOMIZE_ENTRY_SET: ReadonlySet<string> = new Set(
  CUSTOMIZE_ENTRY_POINTS,
);
export const HOME_SCREEN_ACTION_SET: ReadonlySet<string> = new Set(
  HOME_SCREEN_ACTIONS,
);
export const HOME_SCREEN_SURFACE_SET: ReadonlySet<string> = new Set(
  HOME_SCREEN_SURFACES,
);
export const ACCOUNT_LINK_HOST_SET: ReadonlySet<string> = new Set(
  ACCOUNT_LINK_HOSTS,
);
export const ACCOUNT_LINK_FAIL_REASON_SET: ReadonlySet<string> = new Set(
  ACCOUNT_LINK_FAIL_REASONS,
);
export const QUICK_ACTION_ID_SET: ReadonlySet<string> = new Set(
  QUICK_ACTION_IDS,
);
export const QUICK_ACTION_SURFACE_SET: ReadonlySet<string> = new Set(
  QUICK_ACTION_SURFACES,
);
export const QUICK_ACTION_MOVE_DIR_SET: ReadonlySet<string> = new Set(
  QUICK_ACTION_MOVE_DIRS,
);
export const SCREEN_BLOCK_ID_SET: ReadonlySet<string> = new Set(
  SCREEN_BLOCK_IDS,
);
export const CUSTOMIZABLE_SCREEN_SET: ReadonlySet<string> = new Set(
  CUSTOMIZABLE_SCREENS,
);
export const SIGNUP_SOURCE_SET: ReadonlySet<string> = new Set(SIGNUP_SOURCES);
export const PROFILE_PATTERN_KIND_SET: ReadonlySet<string> = new Set(
  PROFILE_PATTERN_KINDS,
);
