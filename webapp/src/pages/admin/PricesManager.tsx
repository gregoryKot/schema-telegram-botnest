import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import type { SessionOption } from '../../api';
import { CURRENCIES, CURRENCY_SYMBOL, type Currency } from '../../../../shared/src/booking/priceRegion';
import { card } from './shared';
import { PriceRow } from './PriceRow';
import { useSaveFeedback } from './useSaveFeedback';

/** Для кого цена: страна посетителя определяется по его часовому поясу. */
const CURRENCY_AUDIENCE: Record<Currency, string> = {
  RUB: 'Россия, онлайн-оплата',
  ILS: 'Израиль',
  EUR: 'остальная Европа',
  USD: 'остальной мир',
};

/** Ключ черновика поля: формат + валюта. */
const draftKey = (type: string, currency: Currency) => `${type}:${currency}`;

/** Сумма опции в валюте для поля ввода; в старом ответе сервера есть только рубли. */
function fieldValue(o: SessionOption, currency: Currency): string {
  const amount = o.prices?.[currency] ?? (currency === 'RUB' ? o.price : undefined);
  return amount === undefined ? '' : String(amount);
}

/** Цены сессии: по строке на валюту (₽, ₪, €, $). Вне рублей онлайн-оплаты нет — бронь подтверждается сразу. */
export function PricesManager({ adminKey }: { adminKey: string }) {
  const [opts, setOpts] = useState<SessionOption[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { guard, feedback } = useSaveFeedback();
  const load = useCallback(() => {
    api.adminGetPrices(adminKey).then((o) => {
      setOpts(o);
      setDraft(Object.fromEntries(o.flatMap((x) => CURRENCIES.map((c) => [draftKey(x.type, c), fieldValue(x, c)]))));
    }).catch(() => setOpts([]));
  }, [adminKey]);
  useEffect(() => { load(); }, [load]);
  const paid = opts.filter((o) => o.type !== 'INTRO_15'); // знакомство бесплатно, не редактируется
  const save = (type: SessionOption['type'], currency: Currency, price: number) =>
    guard(() => api.adminSetPrice(adminKey, type, price, currency).then(() => load()));
  return (
    <section style={card}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>Цены</h2>
      {paid.flatMap((o) => CURRENCIES.map((c) => ( // платная сессия — от 1: цены 0 у неё не бывает
        <PriceRow key={draftKey(o.type, c)} label={`${o.label} · ${o.durationMin} мин · ${CURRENCY_AUDIENCE[c]}`}
          value={draft[draftKey(o.type, c)] ?? ''} min={1} unit={CURRENCY_SYMBOL[c]}
          onChange={(raw) => setDraft({ ...draft, [draftKey(o.type, c)]: raw })} onSave={(price) => save(o.type, c, price)} />
      )))}
      {feedback}
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
        Знакомство всегда бесплатное. Цена применяется к новым записям сразу. Страна посетителя определяется по часовому поясу. Онлайн-оплата есть только в рублях: в остальных валютах запись подтверждается сразу, об оплате вы договариваетесь с человеком сами.
      </p>
    </section>
  );
}
