import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { SessionOption } from '../../api';
import { resolveClientTimeZone } from '../../../../shared/src/booking/clientTimeZone';
import { currencyFromTimeZone } from '../../../../shared/src/booking/priceRegion';
import { DEFAULT_SESSION_PRICE, makePrice, optionPrice, type OptionPrice } from '../../utils/sessionPrice';

/**
 * Живая цена сессии (правится в админке) в валюте посетителя — лендинг
 * совпадает с формой записи. До ответа API и при его сбое — дефолт валюты.
 */
export function useSessionPrice(): OptionPrice {
  const [currency] = useState(() => currencyFromTimeZone(resolveClientTimeZone()));
  const [option, setOption] = useState<SessionOption | null>(null);
  useEffect(() => {
    api.getBookingOptions()
      .then((o) => setOption(o.find((x) => x.type === 'SESSION_50') ?? null))
      .catch(() => {});
  }, []);
  return option ? optionPrice(option, currency) : makePrice(DEFAULT_SESSION_PRICE[currency], currency);
}
