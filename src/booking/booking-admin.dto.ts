import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SessionType } from '@prisma/client';

/**
 * DTO для админ-эндпоинтов ценообразования и правил доступности
 * (аудит 2026-07, 2г / правило №6 CLAUDE.md). Эндпоинты защищены
 * `x-admin-key`, но тело всё равно проверяется рантаймом.
 */
export class SetPriceDto {
  @IsEnum(SessionType)
  type!: SessionType;

  @IsNumber()
  amount!: number;
}

export class SetSubPriceDto {
  @IsIn(['month', 'year'])
  period!: 'month' | 'year';

  @IsNumber()
  amount!: number;
}

export class ToggleRuleDto {
  @IsBoolean()
  isActive!: boolean;
}

/**
 * DTO для POST /api/booking/admin/rules. Раньше dayOfWeek/часы летели в
 * `availability.create(dto)` из локального interface без единой проверки
 * (dayOfWeek мог быть строкой или 99) — admin-key снижает exposure, но
 * второй рубеж всё равно обязан быть.
 */
export class CreateRuleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(0)
  @Max(23)
  startHour!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  startMinute?: number;

  @IsInt()
  @Min(0)
  @Max(24)
  endHour!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  endMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  sessionDuration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  bufferMin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
