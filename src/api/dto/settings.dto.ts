import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VALID_TIMEZONES } from '../../telegram/telegram.constants';

/**
 * DTO для POST /api/settings (аудит 2026-07, 2г / правило №6 CLAUDE.md).
 * Границы (0–23 для часов, 0–3 для частоты, список таймзон и т.п.) уже
 * проверялись вручную в контроллере построением `clean` — здесь та же логика
 * как рантайм-валидация. Ручная сборка `clean` в контроллере не убрана.
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

  @IsOptional()
  @IsIn(VALID_TIMEZONES)
  notifyTimezone?: string;

  @IsOptional()
  @IsBoolean()
  notifyReminderEnabled?: boolean;

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
}
