import { periodLabel, yearDiscountPercent, type SubscriptionOption } from './subscribeDiscount';

type Props = {
  opts: SubscriptionOption[];
  period: 'month' | 'year';
  setPeriod: (p: 'month' | 'year') => void;
  email: string;
  setEmail: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
  status: 'idle' | 'loading' | 'error';
  failed: boolean;
  onSubmit: () => void;
};

const fmt = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

// Форма подписки: слева рассказ, справа тёмная панель с планами и оплатой.
// Страница публичная, без useTr: формулировки безличные, как и раньше.
export function SubscribeForm(p: Props) {
  const price = p.opts.find((o) => o.period === p.period)?.price;
  const discount = yearDiscountPercent(p.opts);
  const blocked = p.status === 'loading' || !price || !p.consent;
  return (
    <div className="light-lock ap-page ap-split">
      <section className="ap-info">
        <div className="ds-eyebrow">Подписка</div>
        <h1 className="ap-h1">Поддержать <i>подпиской</i></h1>
        <p className="ap-lead">«Всё по схеме» бесплатно. Регулярная поддержка помогает развивать проект.</p>
        {p.failed && <p className="ap-err" role="alert">Оплата не прошла. Можно попробовать снова.</p>}
        <ul className="ap-checks">
          <li><span aria-hidden="true">✓</span>Отписаться можно в любой момент</li>
          <li><span aria-hidden="true">✓</span>Оплата картой через Robokassa, автосписание раз в {periodLabel(p.period)}</li>
          <li><span aria-hidden="true">✓</span>Чек — от «Мой налог»</li>
        </ul>
        <a href="/" className="ap-back">← На главную</a>
      </section>

      <section className="ap-pay">
        <div role="radiogroup" aria-label="Период подписки" className="ap-plans">
          {(['month', 'year'] as const).map((per) => {
            const o = p.opts.find((x) => x.period === per);
            const on = p.period === per;
            return (
              <label key={per} className={`ap-plan${on ? ' is-on' : ''}`}>
                <input type="radio" name="period" className="ap-native" checked={on} onChange={() => p.setPeriod(per)} />
                <span className="ap-plan-top">
                  <span className="ap-plan-name">{per === 'year' ? 'Год' : 'Месяц'}</span>
                  <span className="ap-radio" aria-hidden="true" />
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

        <input type="email" className="ym-disable-keys ap-field" value={p.email} onChange={(e) => p.setEmail(e.target.value)} placeholder="Email для чека (необязательно)" />
        <input type="text" tabIndex={-1} autoComplete="off" value={p.website} onChange={(e) => p.setWebsite(e.target.value)} aria-hidden="true" className="ap-honey" />

        <label className="ap-consent">
          <input type="checkbox" className="ap-native" checked={p.consent} onChange={(e) => p.setConsent(e.target.checked)} />
          <span className="ap-box" aria-hidden="true">{p.consent ? '✓' : ''}</span>
          <span>Соглашаюсь на <b>регулярные автосписания</b> раз в {periodLabel(p.period)}. Отменить можно в любой момент.</span>
        </label>

        {p.status === 'error' && <p className="ap-err ap-err--ink" role="alert">Не получилось. Попробовать ещё раз.</p>}
        <button type="button" onClick={p.onSubmit} disabled={blocked} className="ap-cta">
          {p.status === 'loading' ? 'Перехожу к оплате…' : price ? `Оформить за ${fmt(price)}/${periodLabel(p.period)}` : 'Оформить'}
        </button>
        <p className="ap-alt">Или <a href="/donate">разовый донат</a></p>
      </section>
    </div>
  );
}
