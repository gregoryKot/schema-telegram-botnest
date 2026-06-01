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
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'var(--bg)',
      borderTop: '1px solid rgba(var(--fg-rgb),0.1)',
      padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
        Мы используем куки для авторизации (обязательны) и аналитику Яндекс.Метрика, включая запись сессий (по согласию).{' '}
        <a href="/privacy#cookies" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Подробнее</a>
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={accept} style={{
          padding: '8px 18px', background: 'var(--text)', color: 'var(--bg)',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Принять все
        </button>
        <button onClick={decline} style={{
          padding: '8px 18px', background: 'rgba(var(--fg-rgb),0.07)', color: 'var(--text-sub)',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>
          Только необходимые
        </button>
      </div>
    </div>
  );
}
