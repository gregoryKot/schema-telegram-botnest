import { useEffect, useState } from 'react';
import { api } from '../api';
import { CANCEL_SUPPORT_LINK } from '../components/booking/cancelPolicy';
import { PaperOutcome } from '../components/paper/PaperOutcome';
import { ThanksSheet } from '../components/paper/ThanksSheet';
import { CancelControl } from './subscribe/CancelControl';
import { reportSubscriptionLoadFailure } from './subscribe/useSubscriptionCancel';
import { usePageShowReset } from '../hooks/usePageShowReset';
import { SubscribeForm } from './subscribe/SubscribeForm';
import { PayHero, PayLayout, PaySkeleton } from './subscribe/PayLayout';
import { periodLabel, type SubscriptionOption as Opt } from './subscribe/subscribeDiscount';
import { dropUrlParam } from '../utils/dropUrlParam';

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
    if (token) dropUrlParam('token');
  }, [token]);

  const [opts, setOpts] = useState<Opt[]>([]);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [email, setEmail] = useState(''); const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  usePageShowReset(() => setStatus((s) => (s === 'loading' ? 'idle' : s))); // «Назад» с Robokassa — кнопка снова жива

  const [sub, setSub] = useState<Sub | null>(null);
  const [cancelled, setCancelled] = useState(false); const [enabled, setEnabled] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  // Сбой ≠ пусто (правило №14, экран-тупик): раньше `sub === null` на отказе
  // рисовал «Загружаем…» — навсегда, отказ не отличить от загрузки.
  const [subFailed, setSubFailed] = useState<'wait' | 'our_side' | null>(null);

  useEffect(() => {
    api.getSubscriptionOptions()
      .then((r) => { setEnabled(r.enabled); setOpts(r.options); })
      .catch(() => { setEnabled(false); setOpts([]); });
  }, []);
  useEffect(() => {
    if (token) api.getSubscriptionByToken(token).then((s) => { setSub(s); setCancelled(s.status === 'cancelled'); }).catch((err: unknown) => setSubFailed(reportSubscriptionLoadFailure(err)));
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

  const home = { label: '← На главную', href: '/' };
  if (token) {
    // Управление. Отменена — лист «спасибо»; сбой — исход на весь экран (404 — ссылка устарела, «подожди»;
    // остальное — сбой на нашей стороне). Безлично, без useTr (check-second-person.mjs).
    if (cancelled) return <ThanksSheet eyebrow="Подписка" title="Подписка отменена" lead="Спасибо, что были с проектом. Оформить снова можно в любой момент." action={{ label: 'Оформить снова', href: '/subscribe' }} link={home} />;
    if (subFailed) return <PaperOutcome outcome={subFailed} eyebrow="Подписка" title="Не удалось загрузить подписку — возможно, истекла ссылка или нет соединения." action={{ label: 'Обновить', onClick: () => window.location.reload() }} link={home} />;
    if (!sub) return <PaySkeleton shape="manage" />;
    const state = sub.status === 'active' ? 'активна' : sub.status === 'past_due' ? 'проблема с оплатой' : sub.status;
    return (
      <PayLayout hero={<PayHero label="Управление" title="Подписка" lead={<>{sub.amount.toLocaleString('ru-RU')} ₽ / {periodLabel(sub.period)} · {state}</>} />}>
        {sub.nextChargeAt && <div className="ds-card ds-card--row ap-note">Следующее списание: <b>{fmtDate(sub.nextChargeAt)}</b></div>}
        <CancelControl token={token} onCancelled={() => setCancelled(true)} />
      </PayLayout>
    );
  }
  if (ret === 'ok') {
    // Письма со ссылкой управления нет, а «Подписка» в аккаунте ведёт на форму — обещать ни то, ни другое
    // нельзя (open/backend.md). Безлично, как CancelControl.
    return <ThanksSheet eyebrow="Подписка" title="Спасибо за поддержку!" lead={<>Подписка оформлена. Отменить её можно в любой момент — достаточно написать мне в <a href={CANCEL_SUPPORT_LINK} className="ds-link ds-link--inline">Telegram</a>.</>} action={{ label: 'На главную', href: '/' }} />;
  }
  // Скрыта, пока регулярные платежи Robokassa не включены: исход «подожди» (Cup на соломе) и разовый донат.
  if (enabled === false) return <PaperOutcome outcome="wait" eyebrow="Подписка" title="Подписка скоро" lead="Регулярная поддержка пока в разработке. А поддержать проект разово уже можно." action={{ label: 'Разовый донат', href: '/donate' }} link={home} />;
  if (enabled === null) return <PaySkeleton shape="form" />;
  return (
    <SubscribeForm
      opts={opts} period={period} setPeriod={setPeriod} email={email} setEmail={setEmail}
      website={website} setWebsite={setWebsite} consent={consent} setConsent={setConsent}
      status={status} failed={ret === 'fail'} onSubmit={submit}
    />
  );
}
