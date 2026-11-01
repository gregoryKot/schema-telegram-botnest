import { SUB_DEFAULT_PRICE, SubPeriod } from '../booking/booking.config';
import { PRICE_MAX } from '../booking/price-rules';
import { parseWholePrice } from '../booking/whole-price';

// Цена подписки из строки BookingSetting `sub:<period>`. Запись закрыта DTO
// (SetSubPriceDto: 1..PRICE_MAX), а уже лежащий в базе мусор — здесь: раньше
// parseInt читал '1e+22' как 1 ₽. Не целое в границах — дефолт периода.
export function subPriceOrDefault(
  period: SubPeriod,
  raw: string | undefined,
): number {
  return parseWholePrice(raw, 1, PRICE_MAX) ?? SUB_DEFAULT_PRICE[period];
}
