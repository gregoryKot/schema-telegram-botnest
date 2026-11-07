import { useEffect, useState } from 'react';
import { api } from '../api';
import '../styles/auth-pay.css';
import { Cup } from '../components/art/PaperArt';
import { Leaf } from '../components/art/PaperArtSigns';
import { CANCEL_SUPPORT_LINK } from '../components/booking/cancelPolicy';
import { CancelControl } from './subscribe/CancelControl';
import { SubscribeForm } from './subscribe/SubscribeForm';
import { periodLabel, type SubscriptionOption as Opt } from './subscribe/subscribeDiscount';

type Sub = { status: string; period: string; amount: number; nextChargeAt: string | null };

const fmtDate = (iso: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

// Заголовок служебного состояния: eyebrow + ds-h1 + ds-sub слева, страница прижата к верху (#906).
function Hero({ eyebrow = 'Подписка', title, lead, art }: { eyebrow?: string; title: string; lead: React.ReactNode; art?: React.ReactNode }) {
  return (
    <div className="ap-hero">
      {art}<div className="ds-eyebrow">{eyebrow}</div>
      <h1 className="ds-h1">{title}</h1>
      <p className="ds-sub ap-lead">{lead}</p>
    </div>
  );
}

// Public subscription page (/subscribe). Handles the return from Robokassa
// (?sub=ok|fail), the subscribe form, and management (?token=…).
export function SubscribePage() {
  const params = new URLSearchParams(window.location.search);
  const ret = params.get('sub'); // 'ok' | 'fail' | null
  // Capture the management token once, then strip it from the URL so this
  // capability token doesn't linger in history / leak via Referer to analytics.
  const [token] = useState<string | null>(() => new URLSearchParams(window.location.search).get('token'));
  useEffect(() => {
    if (token) { const u = new URL(window.location.href); u.searchParams.delete('token'); window.history.replaceState(window.history.state, '', u.pathname + u.search); }
  }, [token]);

  const [opts, setOpts] = useState<Opt[]>([]);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [email, setEmail] = useState(''); const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const [sub, setSub] = useState<Sub | null>(null);
  const [cancelled, setCancelled] = useState(false); const [enabled, setEnabled] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  // Сбой ≠ пусто (правило №14, экран-тупик): раньше `sub === null` на отказе
  // рисовал «Загружаем…» — навсегда, отказ не отличить от загрузки.
  const [subFailed, setSubFailed] = useState(false);

  useEffect(() => {
    api.getSubscriptionOptions()
      .then((r) => { setEnabled(r.enabled); setOpts(r.options); })
      .catch(() => { setEnabled(false); setOpts([]); });
  }, []);
  useEffect(() => {
    if (token) api.getSubscriptionByToken(token).then((s) => { setSub(s); setCancelled(s.status === 'cancelled'); }).catch(() => setSubFailed(true));
  }, [token]);

  const submit = async () => {
    if (!consent) return;
    setStatus('loading');
    try {
      const res = await api.subscribe({ period, email: email.trim() || undefined, acceptedOffer: consent, website });
      if (res.paymentUrl) { window.location.href = res.paymentUrl; return; }
      window.location.search = '?sub=ok'; // dev / unconfigured
    } catch { setStatus('error'); }
  };

  let body: React.ReactNode;

  if (token) {
    // Management view.
    body = cancelled ? (
      <>
        <Hero art={<Cup size="square" />} title="Подписка отменена" lead="Спасибо, что были с проектом. Оформить снова можно в любой момент." />
        <a href="/subscribe" className="ds-btn ds-btn--lg">Оформить снова</a>
      </>
    ) : sub ? (
      <>
        <Hero art={<Leaf size="square" />} eyebrow="Управление" title="Подписка" lead={<>{sub.amount.toLocaleString('ru-RU')} ₽ / {periodLabel(sub.period)} · {sub.status === 'active' ? 'активна' : sub.status === 'past_due' ? 'проблема с оплатой' : sub.status}</>} />
        {sub.nextChargeAt && <div className="ds-card ds-card--row ap-note">Следующее списание: <b>{fmtDate(sub.nextChargeAt)}</b></div>}
        <CancelControl token={token} onCancelled={() => setCancelled(true)} />
      </>
    ) : subFailed ? (
      // Сбой ≠ пусто: страница публичная, без useTr — формулировка безличная
      // (check-second-person.mjs не видит здесь ни местоимений, ни императивов).
      <div role="alert" className="ap-hero">
        <p className="ap-err">Не удалось загрузить подписку — возможно, истекла ссылка или нет соединения.</p>
        <button type="button" onClick={() => window.location.reload()} className="ds-btn ds-btn--lg">Обновить</button>
      </div>
    ) : (
      <p className="ds-sub ap-lead">Загружаем…</p>
    );
  } else if (ret === 'ok') {
    body = (
      <>
        {/* Письма со ссылкой управления нет, а «Подписка» в аккаунте ведёт на форму —
            обещать ни то, ни другое нельзя (open/backend.md). Безлично, как CancelControl. */}
        <Hero art={<Leaf size="square" />} title="Спасибо за поддержку!" lead={<>Подписка оформлена. Отменить её можно в любой момент — достаточно написать мне в <a href={CANCEL_SUPPORT_LINK} style={{ color: 'inherit', textDecoration: 'underline' }}>Telegram</a>.</>} />
        <a href="/" className="ds-btn ds-btn--lg">На главную</a>
      </>
    );
  } else if (enabled === false) {
    // Hidden until Robokassa's recurring service is live.
    body = (
      <>
        <Hero art={<Cup size="square" />} title="Подписка скоро" lead="Регулярная поддержка пока в разработке. А поддержать проект разово уже можно." />
        <a href="/donate" className="ds-btn ds-btn--lg">Разовый донат</a>
      </>
    );
  } else if (enabled === null) {
    body = <p className="ds-sub ap-lead">Загружаем…</p>;
  } else {
    return (
      <SubscribeForm
        opts={opts} period={period} setPeriod={setPeriod} email={email} setEmail={setEmail}
        website={website} setWebsite={setWebsite} consent={consent} setConsent={setConsent}
        status={status} failed={ret === 'fail'} onSubmit={submit}
      />
    );
  }

  return (
    <div className="light-lock ap-page ap-page--state">
      <div className="ds-sheet-head ds-sheet-head--page"><a href="/" className="ds-back">← На главную</a></div>
      <div className="ds-page ap-main ap-main--state">{body}{(token || ret !== 'ok') && <a href="/" className="ap-home">← На главную</a>}</div>
    </div>
  );
}
