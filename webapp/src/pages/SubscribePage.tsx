import { useEffect, useState } from 'react';
import { api } from '../api';

type Opt = { period: 'month' | 'year'; price: number };
type Sub = { status: string; period: string; amount: number; nextChargeAt: string | null };

const periodLabel = (p: string) => (p === 'year' ? 'год' : 'месяц');
const fmtDate = (iso: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

// Public subscription page (/subscribe). Handles the return from Robokassa
// (?sub=ok|fail), the subscribe form, and management (?token=…).
export function SubscribePage() {
  const params = new URLSearchParams(window.location.search);
  const ret = params.get('sub'); // 'ok' | 'fail' | null
  const token = params.get('token');

  const [opts, setOpts] = useState<Opt[]>([]);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const [sub, setSub] = useState<Sub | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    api.getSubscriptionOptions()
      .then((r) => { setEnabled(r.enabled); setOpts(r.options); })
      .catch(() => { setEnabled(false); setOpts([]); });
  }, []);
  useEffect(() => {
    if (token) api.getSubscriptionByToken(token).then((s) => { setSub(s); setCancelled(s.status === 'cancelled'); }).catch(() => setSub(null));
  }, [token]);

  const price = opts.find((o) => o.period === period)?.price;

  const submit = async () => {
    if (!consent) return;
    setStatus('loading');
    try {
      const res = await api.subscribe({ period, email: email.trim() || undefined, acceptedOffer: consent, website });
      if (res.paymentUrl) { window.location.href = res.paymentUrl; return; }
      window.location.search = '?sub=ok'; // dev / unconfigured
    } catch { setStatus('error'); }
  };

  const doCancel = async () => {
    if (!token) return;
    try { await api.cancelSubscription(token); setCancelled(true); } catch { /* ignore */ }
  };

  let body: React.ReactNode;

  if (token) {
    // Management view.
    body = cancelled ? (
      <>
        <div style={icon}>✓</div>
        <h1 style={h1}>Подписка отменена</h1>
        <p style={sub_}>Спасибо, что были с проектом. Оформить снова можно в любой момент.</p>
        <a href="/subscribe" style={primaryBtn}>Оформить снова</a>
      </>
    ) : sub ? (
      <>
        <div style={icon}>★</div>
        <h1 style={h1}>Ваша подписка</h1>
        <p style={sub_}>{sub.amount.toLocaleString('ru-RU')} ₽ / {periodLabel(sub.period)} · {sub.status === 'active' ? 'активна' : sub.status === 'past_due' ? 'проблема с оплатой' : sub.status}</p>
        {sub.nextChargeAt && <div style={card}>Следующее списание: <b>{fmtDate(sub.nextChargeAt)}</b></div>}
        <button onClick={doCancel} style={textLink}>Отменить подписку</button>
      </>
    ) : (
      <p style={{ ...sub_, marginTop: 40 }}>Загружаем…</p>
    );
  } else if (ret === 'ok') {
    body = (
      <>
        <div style={icon}>💛</div>
        <h1 style={h1}>Спасибо за поддержку!</h1>
        <p style={sub_}>Подписка оформлена. Управлять ей можно по ссылке, которую мы пришлём, или в настройках.</p>
        <a href="/" style={primaryBtn}>На главную</a>
      </>
    );
  } else if (enabled === false) {
    // Hidden until Robokassa's recurring service is live.
    body = (
      <>
        <div style={icon}>🔜</div>
        <h1 style={h1}>Подписка скоро</h1>
        <p style={sub_}>Регулярная поддержка пока в разработке. А поддержать проект разово уже можно. 💛</p>
        <a href="/donate" style={primaryBtn}>Разовый донат</a>
      </>
    );
  } else if (enabled === null) {
    body = <p style={{ ...sub_, marginTop: 40 }}>Загружаем…</p>;
  } else {
    body = (
      <>
        <h1 style={{ ...h1, marginTop: 8 }}>Поддержать подпиской</h1>
        <p style={sub_}>SchemeHappens бесплатный. Регулярная поддержка помогает его развивать. Отписаться можно в любой момент. 💛</p>
        {ret === 'fail' && <p style={{ ...sub_, color: 'var(--accent-red,#c0392b)', fontSize: 14 }}>Оплата не прошла. Можно попробовать снова.</p>}

        <div style={{ display: 'flex', gap: 10, margin: '4px 0 16px' }}>
          {(['month', 'year'] as const).map((p) => {
            const o = opts.find((x) => x.period === p);
            const active = period === p;
            return (
              <button key={p} type="button" onClick={() => setPeriod(p)} style={{
                flex: 1, padding: '14px 12px', cursor: 'pointer', borderRadius: 12, fontFamily: 'inherit', textAlign: 'center',
                background: active ? 'rgba(var(--accent-rgb,77,71,153),0.08)' : 'transparent',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{p === 'year' ? 'Год' : 'Месяц'}</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>{o ? `${o.price.toLocaleString('ru-RU')} ₽` : '…'}</div>
              </button>
            );
          })}
        </div>

        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email для чека (необязательно)" style={field} />
        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', margin: '16px 0 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }} />
          <span style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
            Согласен на <b>регулярные автосписания</b> раз в {periodLabel(period)}. Отменить можно в любой момент.
          </span>
        </label>

        {status === 'error' && <p style={{ ...sub_, color: 'var(--accent-red,#c0392b)', fontSize: 13, margin: '12px 0 0' }}>Не получилось. Попробуйте ещё раз.</p>}
        <button onClick={submit} disabled={status === 'loading' || !price || !consent} style={{ ...primaryBtn, marginTop: 14, opacity: status === 'loading' || !price || !consent ? 0.5 : 1 }}>
          {status === 'loading' ? 'Перехожу к оплате…' : price ? `Оформить за ${price.toLocaleString('ru-RU')} ₽/${periodLabel(period)}` : 'Оформить'}
        </button>
        <p style={hint}>Оплата картой через Robokassa, автосписание раз в {periodLabel(period)}. Чек — от «Мой налог».</p>
      </>
    );
  }

  return (
    <div style={page}>
      <div style={inner}>
        {body}
        <a href="/" style={backLink}>← На главную</a>
      </div>
    </div>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────
// #root is a flex row — must fill it (flex:1 + width:100%) or the column
// shrinks to content width and pins to the left edge on desktop.
const page: React.CSSProperties = { flex: 1, width: '100%', background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', boxSizing: 'border-box' };
const inner: React.CSSProperties = { width: '100%', maxWidth: 400, textAlign: 'center' };
const icon: React.CSSProperties = { width: 56, height: 56, margin: '0 auto 20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--accent-rgb,77,71,153),0.10)', color: 'var(--accent)', fontSize: 26 };
const h1: React.CSSProperties = { fontFamily: 'var(--serif)', fontSize: 'clamp(26px,6vw,32px)', fontWeight: 400, lineHeight: 1.15, letterSpacing: '-.01em', margin: '0 0 10px' };
const sub_: React.CSSProperties = { fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 20px' };
const card: React.CSSProperties = { background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', margin: '0 0 18px', fontSize: 14, color: 'var(--text-sub)' };
const field: React.CSSProperties = { width: '100%', padding: '13px 15px', fontSize: 15, boxSizing: 'border-box', background: 'rgba(var(--fg-rgb),0.04)', border: '1.5px solid var(--line)', borderRadius: 12, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' };
const primaryBtn: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '14px', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', textDecoration: 'none' };
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, margin: '12px 0 0' };
const textLink: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline', marginTop: 4 };
const backLink: React.CSSProperties = { display: 'inline-block', marginTop: 32, fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' };
