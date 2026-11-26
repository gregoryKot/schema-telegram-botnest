import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsTimeZone,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TIMEZONE_MAX_LENGTH } from '../../notification/notify-timezones';

/**
 * DTO для POST /api/settings (аудит 2026-07, 2г / правило №6 CLAUDE.md): те же
 * границы, что ручная сборка `clean` в контроллере, — рантайм-валидацией.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  notifyEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  notifyLocalHour?: number;

  // Любой настоящий пояс IANA: пояс браузера стоит в выборе первым, и повторный
  // тап по нему не должен давать 400 (QA 2026-11-03).
  @IsOptional()
  @IsString()
  @MaxLength(TIMEZONE_MAX_LENGTH)
  @IsTimeZone()
  notifyTimezone?: string;

  @IsOptional()
  @IsBoolean()
  notifyReminderEnabled?: boolean;

  @IsOptional() // «Итоги дня» (R2): сводка после заполнения, вехи, «с возвращением»
  @IsBoolean()
  notifySummaryEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  notifyFrequency?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  notifyQuietStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  notifyQuietEnd?: number;

  @IsOptional()
  @IsBoolean()
  notifyGamified?: boolean;

  // Единственное допустимое значение при возобновлении паузы из UI — null.
  @IsOptional()
  @IsIn([null])
  notifyPausedUntil?: null;

  @IsOptional()
  @IsIn(['ty', 'vy'])
  addressForm?: string;

  @IsOptional()
  @IsBoolean()
  pairCardDismissed?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(99, { each: true })
  mySchemaIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(99, { each: true })
  myModeIds?: string[];

  @IsOptional()
  @IsBoolean()
  therapistShareCards?: boolean;

  @IsOptional()
  @IsBoolean()
  therapistShareProfile?: boolean;

  // Серверное зеркало кастомизации мини-аппа (SYNCED_PREF_KEYS): плоский
  // { ключ → строка }; неизвестное отбрасывает sanitizeUiPrefs (per-key), здесь
  // — только «это объект».
  @IsOptional()
  @IsObject()
  uiPrefs?: Record<string, unknown>;
}
