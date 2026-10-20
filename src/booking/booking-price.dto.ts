import { IsEnum, IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { SessionType } from '@prisma/client';
import { PRICE_MAX } from './price-rules';
import { CURRENCIES, type Currency } from './price-region';

/** DTO цен (PATCH /admin/price, /admin/sub-price). Потолок — защита от мусора
 * (1e22 раньше давало 1 ₽). Нижняя граница платной сессии — в PricingService.setPrice. */
export class SetPriceDto {
  @IsEnum(SessionType)
  type!: SessionType;

  @IsNumber()
  @Min(0)
  @Max(PRICE_MAX)
  amount!: number;
  @IsOptional() @IsIn(CURRENCIES) currency?: Currency; // без неё — рубли
}

export class SetSubPriceDto {
  @IsIn(['month', 'year'])
  period!: 'month' | 'year';

  @IsNumber()
  @Min(1)
  @Max(PRICE_MAX)
  amount!: number;
}
