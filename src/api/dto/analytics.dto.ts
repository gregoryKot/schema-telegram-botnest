import { IsIn, IsObject, IsOptional } from 'class-validator';
import {
  ANALYTICS_EVENTS,
  CRISIS_SURFACES,
  ONBOARDING_STEPS,
  SHARE_CARD_KINDS,
  TODAY_FOCUS_PRACTICES,
  WEB_BANNER_IDS,
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
