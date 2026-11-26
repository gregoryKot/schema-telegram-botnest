// Валюта цены на сайте: по поясу посетителя, а при поясе без места (UTC и т. п.)
// — по его явному выбору (решение владельца Р5). Выбор живёт в памяти вкладки,
// общий для формы записи и цены на лендинге: выбрал евро в форме — евро и в
// блоке «Формат и цены». После перезагрузки снова рубли: в localStorage выбор
// не пишется, чтобы старый выбор не пережил смену пояса.
import { useSyncExternalStore } from 'react';
import {
  isPlacelessTimeZone,
  resolvePriceCurrency,
  type Currency,
} from '../../../../shared/src/booking/priceRegion';

let chosen: Currency | null = null;
const listeners = new Set<() => void>();

/** Выбрать валюту (null — вернуть валюту по поясу). */
export function setChosenCurrency(next: Currency | null): void {
  chosen = next;
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

const read = (): Currency | null => chosen;

/** Явно выбранная валюта (или null), одна на вкладку. */
export function useChosenCurrency(): Currency | null {
  return useSyncExternalStore(subscribe, read, read);
}

export interface PriceCurrency {
  /** Валюта показа — та же, что посчитает сервер (resolvePriceCurrency). */
  currency: Currency;
  /** Что отправить в BookDto.currency: выбор, только если пояс без места. */
  explicit: Currency | undefined;
}

/** Валюта цены для пояса `tz` с учётом явного выбора. */
export function usePriceCurrency(tz: string): PriceCurrency {
  const pick = useChosenCurrency();
  const explicit = pick && isPlacelessTimeZone(tz) ? pick : undefined;
  return { currency: resolvePriceCurrency(tz, pick), explicit };
}
