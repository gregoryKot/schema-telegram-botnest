import { IsEnum, IsIn, IsNumber, Max, Min } from 'class-validator';
import { SessionType } from '@prisma/client';
import { PRICE_MAX } from './price-rules';

/**
 * DTO цен (PATCH /admin/price, /admin/sub-price). Потолок — защита от мусора:
 * 1e22 раньше превращалось в 1 ₽ при разборе. Нижняя граница цены сессии
 * зависит от типа (INTRO_15 законно 0, платная — от 1) и проверяется в
 * PricingService.setPrice — в DTO она потребовала бы @ValidateIf по `type`.
 */
export class SetPriceDto {
  @IsEnum(SessionType)
  type!: SessionType;

  @IsNumber()
  @Min(0)
  @Max(PRICE_MAX)
  amount!: number;
}

export class SetSubPriceDto {
  @IsIn(['month', 'year'])
  period!: 'month' | 'year';

  @IsNumber()
  @Min(1)
  @Max(PRICE_MAX)
  amount!: number;
}
