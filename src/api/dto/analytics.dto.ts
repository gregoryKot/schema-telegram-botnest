import { IsIn, IsObject, IsOptional } from 'class-validator';
import {
  ANALYTICS_EVENTS,
  SHARE_CARD_KINDS,
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

// Допустимые значения meta.kind для события share_card — экспортируются для
// проверки в контроллере (санитизация meta перед записью).
export const SHARE_CARD_KIND_SET: ReadonlySet<string> = new Set(
  SHARE_CARD_KINDS,
);
