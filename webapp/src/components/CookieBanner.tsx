import { useState, useEffect } from 'react';

const CONSENT_KEY = 'cookie_consent';
const YM_ID = 109568051;

type YmFn = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

export function loadMetrika() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __ym_loaded?: boolean; ym?: YmFn };
  if (w.__ym_loaded) return;
  w.__ym_loaded = true;
  w.ym =
    w.ym ||
    function (...args: unknown[]) {
      (w.ym!.a = w.ym!.a || []).push(args);
    };
  w.ym.l = Date.now();
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}`;
  document.head.appendChild(s);
  w.ym(YM_ID, 'init', {
    webvisor: true,
    clickmap: true,
    accurateTrackBounce: true,
    trackLinks: true,
    defer: true,
  });
}

export function CookieBanner() {
  // Начальная видимость выводится из localStorage на маунте (lazy-init), а не
  // через setState в эффекте (react-hooks/set-state-in-effect). Побочный
  // эффект (загрузка метрики при ранее данном согласии) остаётся в эффекте.
  const [visible, setVisible] = useState(
    () => !localStorage.getItem(CONSENT_KEY),
  );

  useEffect(() => {
    if (localStorage.getItem(CONSENT_KEY) === 'all') {
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
      padding: '0 16px 20px',
      pointerEvents: 'none',
    }}>
      <div
        className="cookie-banner"
        role="dialog"
        aria-label="Согласие на использование куки"
        style={{
          width: 'min(100%, 440px)', margin: '0 auto',
          padding: '20px 22px 18px',
          display: 'flex', flexDirection: 'column', gap: 18,
          pointerEvents: 'auto',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ position: 'relative', flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="cookie-glow" />
            <div style={{
              position: 'relative', width: 44, height: 44, borderRadius: 14,
              background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>
              <span className="cookie-emoji">🍪</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--serif)', fontSize: 21, lineHeight: 1.15,
              color: 'var(--text)', marginBottom: 6, letterSpacing: '0.01em',
            }}>
              Немного о куки
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>
              Часть нужна для входа – без них сайт не работает. Аналитику Яндекс.Метрики (с записью сессий) включаем только с вашего согласия.{' '}
              <a href="/privacy#cookies" style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2, fontWeight: 500 }}>
                Подробнее
              </a>
            </p>
          </div>
        </div>

        {/* Actions – equal prominence (GDPR 2026): same size, both solid */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={decline} className="cookie-btn cookie-btn-reject">
            Только необходимые
          </button>
          <button onClick={accept} className="cookie-btn cookie-btn-accept">
            Принять все
          </button>
        </div>
      </div>
    </div>
  );
}
