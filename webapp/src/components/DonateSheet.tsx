import { useState } from 'react';
import { api } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';

const PRESETS = [200, 500, 1000, 2000];

/** Donation sheet: pick/enter an amount, pay via Robokassa. Default 500 ₽. */
export function DonateSheet({ onClose, source = 'app' }: { onClose: () => void; source?: 'app' | 'game' }) {
  const goBack = useHistorySheet(onClose);
  const [amount, setAmount] = useState(500);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const submit = async () => {
    if (amount < 10) return;
    setStatus('loading');
    try {
      const res = await api.donate({ amount, source, email: email.trim() || undefined, website });
      if (res.paymentUrl) { window.location.href = res.paymentUrl; return; }
      setStatus('done'); // dev / unconfigured — no real payment
    } catch { setStatus('error'); }
  };

  const field: React.CSSProperties = {
    width: '100%', padding: '13px 15px', fontSize: 15, boxSizing: 'border-box',
    background: 'rgba(var(--fg-rgb),0.04)', border: '1.5px solid var(--line)',
    borderRadius: 12, color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '24px 20px 60px' }}>
        <button onClick={goBack} style={{ background: 'none', border: 'none', color: 'var(--text-sub)', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', padding: '4px 0', marginBottom: 16 }}>← Назад</button>

        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>💛</div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--text)', margin: '0 0 10px' }}>Спасибо за поддержку!</h2>
            <p style={{ color: 'var(--text-sub)', fontSize: 15, lineHeight: 1.6 }}>Это очень помогает развивать проект.</p>
            <button onClick={goBack} style={{ marginTop: 20, padding: '12px 26px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>Закрыть</button>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 8px' }}>Поддержать проект</h2>
            <p style={{ color: 'var(--text-sub)', fontSize: 15, lineHeight: 1.6, margin: '0 0 24px' }}>
              SchemeHappens бесплатный. Если он полезен — поддержите развитие любой суммой. 💛
            </p>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>Сумма</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(p)} style={{
                  flex: '1 1 60px', padding: '11px 0', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 10,
                  background: amount === p ? 'var(--accent)' : 'transparent', color: amount === p ? '#fff' : 'var(--text-sub)',
                  border: `1.5px solid ${amount === p ? 'var(--accent)' : 'var(--line-strong)'}`,
                }}>{p} ₽</button>
              ))}
            </div>
            <input type="number" min={10} max={100000} value={amount} onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value))))}
              style={{ ...field, marginBottom: 16 }} placeholder="Своя сумма, ₽" />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>Email для чека <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...field, marginBottom: 20 }} placeholder="you@example.com" />

            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

            {status === 'error' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: '0 0 12px' }}>Не получилось. Попробуйте ещё раз.</p>}

            <button onClick={submit} disabled={status === 'loading' || amount < 10} style={{
              width: '100%', padding: '15px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12,
              cursor: 'pointer', opacity: status === 'loading' || amount < 10 ? 0.5 : 1,
            }}>
              {status === 'loading' ? 'Перехожу к оплате…' : `Поддержать ${amount.toLocaleString('ru-RU')} ₽`}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>Оплата картой или СБП через Robokassa.<br />Добровольное пожертвование, возврату не подлежит.</p>
          </>
        )}
      </div>
    </div>
  );
}
