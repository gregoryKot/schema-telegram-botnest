import { useEffect, useState } from 'react';
import { api } from '../api';
import '../styles/auth-pay.css';
import { CancelControl } from './subscribe/CancelControl';
import { SubscribeForm } from './subscribe/SubscribeForm';
import { periodLabel, type SubscriptionOption as Opt } from './subscribe/subscribeDiscount';

type Sub = { status: string; period: string; amount: number; nextChargeAt: string | null };

const fmtDate = (iso: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

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
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const [sub, setSub] = useState<Sub | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
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
        <div className="ap-icon">✓</div>
        <h1 className="ap-h1 ap-h1--sm">Подписка отменена</h1>
        <p className="ap-lead">Спасибо, что были с проектом. Оформить снова можно в любой момент.</p>
        <a href="/subscribe" className="ap-btn">Оформить снова</a>
      </>
    ) : sub ? (
      <>
        <div className="ap-icon">◆</div>
        <h1 className="ap-h1 ap-h1--sm">Подписка</h1>
        <p className="ap-lead">{sub.amount.toLocaleString('ru-RU')} ₽ / {periodLabel(sub.period)} · {sub.status === 'active' ? 'активна' : sub.status === 'past_due' ? 'проблема с оплатой' : sub.status}</p>
        {sub.nextChargeAt && <div className="ap-note">Следующее списание: <b>{fmtDate(sub.nextChargeAt)}</b></div>}
        <CancelControl token={token} onCancelled={() => setCancelled(true)} />
      </>
    ) : subFailed ? (
      // Сбой ≠ пусто: страница публичная, без useTr — формулировка безличная
      // (check-second-person.mjs не видит здесь ни местоимений, ни императивов).
      <div role="alert">
        <p className="ap-lead ap-err">Не удалось загрузить подписку — возможно, истекла ссылка или нет соединения.</p>
        <button onClick={() => window.location.reload()} className="ap-btn">Обновить</button>
      </div>
    ) : (
      <p className="ap-lead">Загружаем…</p>
    );
  } else if (ret === 'ok') {
    body = (
      <>
        <div className="ap-icon">✓</div>
        <h1 className="ap-h1 ap-h1--sm">Спасибо за поддержку!</h1>
        <p className="ap-lead">Подписка оформлена. Управлять ею можно по ссылке, которую мы пришлём, или в настройках.</p>
        <a href="/" className="ap-btn">На главную</a>
      </>
    );
  } else if (enabled === false) {
    // Hidden until Robokassa's recurring service is live.
    body = (
      <>
        <div className="ap-icon">·</div>
        <h1 className="ap-h1 ap-h1--sm">Подписка скоро</h1>
        <p className="ap-lead">Регулярная поддержка пока в разработке. А поддержать проект разово уже можно.</p>
        <a href="/donate" className="ap-btn">Разовый донат</a>
      </>
    );
  } else if (enabled === null) {
    body = <p className="ap-lead">Загружаем…</p>;
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
    <div className="light-lock ap-page ap-page--center">
      <div className="ap-card">
        {body}
        <a href="/" className="ap-back">← На главную</a>
      </div>
    </div>
  );
}
