import { useState } from 'react';
import { api } from '../api';

const PRESETS = [200, 500, 1000, 2000];

// Public donation page (no auth) at /donate. Handles the return from Robokassa
// (?donation=ok|fail) and otherwise shows the donation form. The game and the
// in-app sheet both ultimately land donors here so they never hit /login.
export function DonatePage() {
  const params = new URLSearchParams(window.location.search);
  const ret = params.get('donation'); // 'ok' | 'fail' | null
  const [amount, setAmount] = useState(500);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const submit = async () => {
    if (amount < 10) return;
    setStatus('loading');
    try {
      const res = await api.donate({ amount, source: 'app', email: email.trim() || undefined, website });
      if (res.paymentUrl) { window.location.href = res.paymentUrl; return; }
      window.location.search = '?donation=ok'; // dev / unconfigured
    } catch { setStatus('error'); }
  };

  const field: React.CSSProperties = {
    width: '100%', padding: '13px 15px', fontSize: 15, boxSizing: 'border-box',
    background: 'rgba(var(--fg-rgb),0.04)', border: '1.5px solid var(--line)',
    borderRadius: 12, color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '48px 20px 60px' }}>
        <a href="/" style={{ color: 'var(--text-sub)', fontSize: 15, textDecoration: 'none' }}>← На главную</a>

        {ret === 'ok' ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>💛</div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, margin: '0 0 10px' }}>Спасибо за поддержку!</h1>
            <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.6 }}>Это очень помогает развивать проект.</p>
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400, margin: '0 0 8px' }}>Поддержать проект</h1>
            <p style={{ color: 'var(--text-sub)', fontSize: 15, lineHeight: 1.6, margin: '0 0 24px' }}>
              SchemeHappens бесплатный. Если он полезен — поддержите развитие любой суммой. 💛
            </p>
            {ret === 'fail' && <p style={{ color: 'var(--accent-red)', fontSize: 14, margin: '0 0 16px' }}>Оплата не прошла. Можно попробовать снова.</p>}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(p)} style={{
                  flex: '1 1 60px', padding: '12px 0', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 10,
                  background: amount === p ? 'var(--accent)' : 'transparent', color: amount === p ? '#fff' : 'var(--text-sub)',
                  border: `1.5px solid ${amount === p ? 'var(--accent)' : 'var(--line-strong)'}`,
                }}>{p} ₽</button>
              ))}
            </div>
            <input type="number" min={10} max={100000} value={amount} onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value))))} style={{ ...field, marginBottom: 16 }} placeholder="Своя сумма, ₽" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...field, marginBottom: 20 }} placeholder="Email для чека (необязательно)" />
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

            {status === 'error' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: '0 0 12px' }}>Не получилось. Попробуйте ещё раз.</p>}
            <button onClick={submit} disabled={status === 'loading' || amount < 10} style={{
              width: '100%', padding: '15px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12,
              cursor: 'pointer', opacity: status === 'loading' || amount < 10 ? 0.5 : 1,
            }}>
              {status === 'loading' ? 'Перехожу к оплате…' : `Поддержать ${amount.toLocaleString('ru-RU')} ₽`}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', marginTop: 12 }}>Оплата картой или СБП через Robokassa</p>
          </div>
        )}
      </div>
    </div>
  );
}
