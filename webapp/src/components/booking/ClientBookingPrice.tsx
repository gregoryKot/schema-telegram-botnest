// Цена в листе «Запись на сессию» (R9): сколько стоит сессия и как она
// оплачивается — до нажатия «Записаться». При поясе без места — тот же выбор
// валюты, что у формы на визитке (CurrencyChoice); выбор уходит в тело записи,
// и сервер считает цену по тому же правилу (resolveBookingPrice).
import type { OptionPrice } from '../../utils/sessionPrice';
import { Skeleton } from '../Skeleton';
import { CurrencyChoice } from './CurrencyChoice';
import { SessionTicket } from './SessionTicket';
import { glue } from '../../../../shared/src/utils/typo';
import { fieldLabel } from './fieldLabelStyle';
import type { Tr } from './slotsCopy';

/** Строка цены: рубли — оплата онлайн после записи, другая валюта — без онлайн-оплаты. */
function clientPriceNote(price: OptionPrice): string {
  return price.online
    ? `Сессия — ${price.text}, оплата картой или СБП сразу после записи.`
    : `Сессия — ${price.text}, запись подтвердится сразу: об оплате терапевт напишет перед встречей.`;
}

export function ClientBookingPrice({ tz, tr, price, when }: {
  tz: string;
  tr: Tr;
  /** undefined — грузится (силуэт строки); null — цены нет, строки тоже нет. */
  price: OptionPrice | null | undefined;
  /** Окно выбрано — строка «когда» (sessionWhen): цена встаёт в билет сессии рядом с днём и временем. */
  when?: string;
}) {
  const note = price === undefined ? <Skeleton width="70%" height={14} />
    : price ? <p className="cbk-note">{glue(clientPriceNote(price))}</p> : null;
  return (
    <>
      {when ? <SessionTicket row className="ym-hide-content" when={when}>{note}</SessionTicket> : note}
      <CurrencyChoice tz={tz} labelStyle={fieldLabel} tr={tr} />
    </>
  );
}
