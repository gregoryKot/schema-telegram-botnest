import { useState, useEffect } from 'react';

const CONSENT_KEY = 'cookie_consent';
const YM_ID = 109568051;

export function loadMetrika() {
  if (typeof window === 'undefined' || (window as any).__ym_loaded) return;
  (window as any).__ym_loaded = true;
  const w = window as any;
  w['ym'] = w['ym'] || function () { (w['ym'].a = w['ym'].a || []).push(arguments); };
  w['ym'].l = 1 * Date.now();
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}`;
  document.head.appendChild(s);
  w['ym'](YM_ID, 'init', { webvisor: true, clickmap: true, accurateTrackBounce: true, trackLinks: true, defer: true });
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    } else if (consent === 'all') {
      loadMetrika();
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'all');
    loadMetrika();
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, 'necessary');
    setVisible(false);
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 9999,
      display: 'flex', justifyContent: 'center',
      padding: '0 16px 20px',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(28,25,20,0.13), 0 2px 8px rgba(28,25,20,0.07)',
        padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: 14,
        pointerEvents: 'auto',
        animation: 'cookie-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20, lineHeight: 1, paddingTop: 1, flexShrink: 0 }}>🍪</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Куки и аналитика
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-sub)', lineHeight: 1.55 }}>
              Обязательные куки нужны для входа. Яндекс.Метрика с записью сессий — только с вашего согласия.{' '}
              <a href="/privacy#cookies" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                Подробнее
              </a>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={decline}
            style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid var(--line)',
              background: 'var(--surface-2)', color: 'var(--text-sub)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'var(--surface-3)'; (e.target as HTMLButtonElement).style.borderColor = 'var(--line-strong)'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'var(--surface-2)'; (e.target as HTMLButtonElement).style.borderColor = 'var(--line)'; }}
          >
            Только нужные
          </button>
          <button
            onClick={accept}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: 'var(--text)', color: 'var(--bg)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'var(--accent)'; (e.target as HTMLButtonElement).style.color = 'var(--on-accent)'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'var(--text)'; (e.target as HTMLButtonElement).style.color = 'var(--bg)'; }}
          >
            Принять все
          </button>
        </div>
      </div>
    </div>
  );
}
