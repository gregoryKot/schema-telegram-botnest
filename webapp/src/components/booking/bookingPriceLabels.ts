// Подписи формы записи, зависящие от цены: рубли — онлайн-оплата (Robokassa),
// другие валюты — бронь подтверждается сразу, об оплате договариваются после
// записи (решение владельца 2026-10-20). Вынесено из BookingPicker (правило №10).
import { optionPrice, type OptionPrice } from '../../utils/sessionPrice';
import type { Currency } from '../../../../shared/src/booking/priceRegion';
import type { SessionOption } from '../../api.types';

export interface BookingPriceView extends OptionPrice {
  /** Сумма больше нуля: платный формат. */
  paid: boolean;
}

/** Цена выбранного формата в валюте посетителя; нет опции — «бесплатно». */
export function bookingPriceView(opt: SessionOption | undefined, currency: Currency): BookingPriceView {
  const price = optionPrice(opt, currency);
  return { ...price, paid: price.amount > 0 };
}

/** Что идёт после названия формата на кнопке: «· 70 $» или «· бесплатно». */
export function formatPriceSuffix(opt: SessionOption, currency: Currency): string {
  const view = bookingPriceView(opt, currency);
  return view.paid ? `· ${view.text}` : '· бесплатно';
}

/** Платный формат с онлайн-оплатой: после брони идёт экран «перейти к оплате». */
export const needsOnlinePayment = (view: BookingPriceView): boolean => view.paid && view.online;

/** Текст кнопки отправки; `bookLabel` — «Записаться на …» для бесплатного и безоплатного онлайн пути. */
export function submitLabel(view: BookingPriceView, loading: boolean, bookLabel: string): string {
  if (needsOnlinePayment(view)) return loading ? 'Перехожу к оплате…' : `Оплатить ${view.text} и записаться →`;
  return loading ? 'Бронирую…' : bookLabel;
}

/** Пояснение под кнопкой отправки. */
export function submitNote(view: BookingPriceView): string {
  if (!view.paid) return 'Первая встреча 15 минут — бесплатно. Никаких обязательств.';
  if (view.online) return 'Оплата картой или СБП через Robokassa. Чек придёт автоматически.';
  return `Сессия – ${view.text}. Об оплате договоримся после записи.`;
}

/** Строка на экране «Время забронировано»: только платная сессия без онлайн-оплаты. */
export function doneCostNote(view: BookingPriceView, type: SessionOption['type']): string | null {
  if (type !== 'SESSION_50' || !view.paid || view.online) return null;
  return `Стоимость сессии – ${view.text}. Об оплате напишу вам перед встречей.`;
}
