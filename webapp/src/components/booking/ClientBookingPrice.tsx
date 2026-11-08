// Цена в листе «Запись на сессию» (R9): сколько стоит сессия и как она
// оплачивается — до нажатия «Записаться». При поясе без места — тот же выбор
// валюты, что у формы на визитке (CurrencyChoice); выбор уходит в тело записи,
// и сервер считает цену по тому же правилу (resolveBookingPrice).
import type { OptionPrice } from '../../utils/sessionPrice';
import { Skeleton } from '../Skeleton';
import { CurrencyChoice } from './CurrencyChoice';
import { fieldLabel } from './fieldLabelStyle';
import type { Tr } from './slotsCopy';

/** Строка цены: рубли — оплата онлайн после записи, другая валюта — без онлайн-оплаты. */
function clientPriceNote(price: OptionPrice): string {
  return price.online
    ? `Сессия — ${price.text}, оплата картой или СБП сразу после записи.`
    : `Сессия — ${price.text}, запись подтвердится сразу: об оплате терапевт напишет перед встречей.`;
}

export function ClientBookingPrice({ tz, tr, price }: {
  tz: string;
  tr: Tr;
  /** undefined — грузится (силуэт строки); null — цены нет, строки тоже нет. */
  price: OptionPrice | null | undefined;
}) {
  return (
    <>
      {price === undefined && <Skeleton width="70%" height={14} />}
      {price && <p className="cbk-note">{clientPriceNote(price)}</p>}
      <CurrencyChoice tz={tz} labelStyle={fieldLabel} tr={tr} />
    </>
  );
}
