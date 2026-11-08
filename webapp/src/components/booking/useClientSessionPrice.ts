// Цена сессии для листа записи из приложения (R9): живая цена SESSION_50 из
// GET /api/booking/options в той валюте, которую посчитает сервер, — по поясу
// листа и по явному выбору при поясе без места (usePriceCurrency →
// resolvePriceCurrency, тот же расчёт, что у формы на визитке).
import { useEffect, useState } from 'react';
import { api, reportClientError, type SessionOption } from '../../api';
import { optionPrice, type OptionPrice } from '../../utils/sessionPrice';
import type { Currency } from '../../../../shared/src/booking/priceRegion';
import { usePriceCurrency } from './priceCurrency';

export interface ClientSessionPrice {
  /** undefined — грузится; null — цены нет (сбой или формат не настроен). */
  price: OptionPrice | null | undefined;
  /** Что отправить в теле записи: выбор, только если пояс без места. */
  explicit: Currency | undefined;
}

export function useClientSessionPrice(tz: string): ClientSessionPrice {
  const { currency, explicit } = usePriceCurrency(tz);
  const [option, setOption] = useState<SessionOption | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api.getBookingOptions()
      .then((all) => { if (alive) setOption(all.find((o) => o.type === 'SESSION_50') ?? null); })
      .catch(() => {
        // Запись работает и без строки цены (сумму считает сервер), но сбой не прячем (№14).
        if (alive) setOption(null);
        reportClientError({ message: 'client booking: цена сессии не загрузилась', section: 'client-booking' });
      });
    return () => { alive = false; };
  }, []);
  return { price: option ? optionPrice(option, currency) : option, explicit };
}
