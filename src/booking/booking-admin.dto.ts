import { IsBoolean, IsEnum, IsIn, IsNumber } from 'class-validator';
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
