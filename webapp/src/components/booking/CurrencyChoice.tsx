// Выбор валюты при поясе без места (решение владельца Р5). UTC и его синонимы
// не говорят, где человек: по умолчанию цена в рублях с оплатой онлайн, а
// посетитель не из России выбирает валюту сам. При настоящем поясе блока нет —
// валюта по поясу, и сервер выбор тоже не примет (resolvePriceCurrency).
import { CURRENCIES, CURRENCY_SYMBOL, isPlacelessTimeZone, type Currency } from '../../../../shared/src/booking/priceRegion';
import { trackGoal } from '../../lib/metrika';
import { Chip } from './Chip';
import { setChosenCurrency, useChosenCurrency } from './priceCurrency';
import { VY, type Tr } from './slotsCopy';

const IN_CURRENCY: Record<Currency, string> = { RUB: 'в рублях', ILS: 'в шекелях', EUR: 'в евро', USD: 'в долларах' };
const FOREIGN = CURRENCIES.filter((c) => c !== 'RUB');
const noteSt: React.CSSProperties = { fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, margin: '8px 0 0' };

/** `tr` — как у выбора слота: визитка публичная и говорит «вы» по умолчанию. */
export function CurrencyChoice({ tz, labelStyle, tr = VY }: { tz: string; labelStyle: React.CSSProperties; tr?: Tr }) {
  const chosen = useChosenCurrency();
  if (!isPlacelessTimeZone(tz)) return null;
  const pick = (c: Currency) => {
    const next = chosen === c ? null : c; // повторное нажатие возвращает рубли
    if (next) trackGoal('booking_currency', { currency: next });
    setChosenCurrency(next);
  };
  return (
    <div>
      <div id="bp-currency" style={labelStyle}>Я не в России — показать цену</div>
      <div className="u-wrap8" role="group" aria-labelledby="bp-currency">
        {FOREIGN.map((c) => (
          <Chip key={c} active={chosen === c} onClick={() => pick(c)} style={{ minHeight: 44 }}>
            {IN_CURRENCY[c]} {CURRENCY_SYMBOL[c]}
          </Chip>
        ))}
      </div>
      <p style={noteSt}>
        {chosen
          ? tr('В этой валюте оплаты онлайн нет: об оплате договоримся после записи. Чтобы вернуть рубли, нажми на валюту ещё раз.',
            'В этой валюте оплаты онлайн нет: об оплате договоримся после записи. Чтобы вернуть рубли, нажмите на валюту ещё раз.')
          : tr('Часовой пояс не определился, поэтому цена в рублях с оплатой онлайн. Если ты не в России, выбери валюту.',
            'Часовой пояс не определился, поэтому цена в рублях с оплатой онлайн. Если вы не в России, выберите валюту.')}
      </p>
    </div>
  );
}
