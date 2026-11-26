import { SignArt } from '../../components/art/SignArt';
import { PaperAlert } from '../../components/paper/PaperAlert';
import { PayHero, PayLayout } from './PayLayout';
import { periodLabel, yearDiscountPercent, type SubscriptionOption } from './subscribeDiscount';

type Props = {
  opts: SubscriptionOption[];
  period: 'month' | 'year';
  setPeriod: (p: 'month' | 'year') => void;
  email: string; setEmail: (v: string) => void;
  website: string; setWebsite: (v: string) => void;
  consent: boolean; setConsent: (v: boolean) => void;
  status: 'idle' | 'loading' | 'error';
  failed: boolean;
  onSubmit: () => void;
};

const fmt = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

// Форма подписки: лист соломы со сценой (PayHero) и форма рядом (PayLayout, разворот на ≥1024). Тарифы —
// плитки бумаги: выбранная — бумага соломы с тёмной кромкой и галочкой, а не цветной контур. Страница
// публичная, без useTr: формулировки безличные, как и раньше.
export function SubscribeForm(p: Props) {
  const price = p.opts.find((o) => o.period === p.period)?.price;
  const discount = yearDiscountPercent(p.opts);
  const blocked = p.status === 'loading' || !price || !p.consent;
  return (
    <PayLayout hero={<PayHero label="Подписка" title={<>Поддержать <i>подпиской</i></>} lead="«Всё по схеме» бесплатно. Регулярная поддержка помогает развивать проект." />}>
      {p.failed && <PaperAlert title="Оплата не прошла. Можно попробовать снова." />}
      <div role="radiogroup" aria-label="Период подписки" className="ap-plans">
        {(['month', 'year'] as const).map((per) => {
          const o = p.opts.find((x) => x.period === per);
          const on = p.period === per;
          return (
            <label key={per} className={`ap-plan${on ? ' is-on' : ''}`}>
              <input type="radio" name="period" className="ap-native" checked={on} onChange={() => p.setPeriod(per)} />
              <span className="ap-plan-top">
                <span className="ap-plan-name">{per === 'year' ? 'Год' : 'Месяц'}</span>
                <span className="ap-radio" aria-hidden="true">{on && <SignArt sign="check" size="row" />}</span>
              </span>
              <span className="ap-plan-bottom">
                <span className="ap-plan-price">{o ? fmt(o.price) : '…'}</span>
                <span className="ap-plan-per">/ {periodLabel(per)}</span>
                {per === 'year' && discount > 0 && <span className="ap-badge">−{discount}%</span>}
              </span>
            </label>
          );
        })}
      </div>

      <input type="email" className="ym-disable-keys ds-input" value={p.email} onChange={(e) => p.setEmail(e.target.value)} placeholder="Email для чека (необязательно)" />
      <input type="text" tabIndex={-1} autoComplete="off" value={p.website} onChange={(e) => p.setWebsite(e.target.value)} aria-hidden="true" className="ap-honey" />

      <label className="ap-consent">
        <input type="checkbox" checked={p.consent} onChange={(e) => p.setConsent(e.target.checked)} />
        <span>Соглашаюсь на <b>регулярные автосписания</b> раз в {periodLabel(p.period)}. Отменить можно в любой момент.</span>
      </label>

      {p.status === 'error' && <PaperAlert title="Не получилось. Попробовать ещё раз." className="ap-err" />}
      <button type="button" onClick={p.onSubmit} disabled={blocked} aria-busy={p.status === 'loading' || undefined} className="ds-btn ds-btn--accent ds-btn--lg ap-cta">
        {p.status === 'loading' ? 'Перехожу к оплате…' : price ? `Оформить за ${fmt(price)}/${periodLabel(p.period)}` : 'Оформить'}
      </button>
      <ul className="ap-checks">
        <li>Отписаться можно в любой момент</li>
        <li>Оплата картой через Robokassa, автосписание раз в {periodLabel(p.period)}</li>
        <li>Чек — от «Мой налог»</li>
      </ul>
      <p className="ap-alt">Или <a href="/donate">разовый донат</a></p>
    </PayLayout>
  );
}
