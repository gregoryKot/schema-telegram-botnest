import { useState, useEffect } from 'react';
import { loadMetrika } from '../lib/metrika';

const CONSENT_KEY = 'cookie_consent';

export function CookieBanner() {
  // Начальная видимость выводится из localStorage на маунте (lazy-init), а не
  // через setState в эффекте (react-hooks/set-state-in-effect). Значение
  // 'all' и 'necessary' из старых визитов одинаково прячут баннер.
  const [visible, setVisible] = useState(
    () => !localStorage.getItem(CONSENT_KEY),
  );

  useEffect(() => {
    // Метрика грузится безусловно — владелец решил не ждать согласия.
    // Баннер ниже теперь просто уведомление, а не переключатель аналитики.
    loadMetrika();
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(CONSENT_KEY, 'all');
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
        aria-label="Уведомление об использовании куки"
        style={{
          width: 'min(100%, 440px)', margin: '0 auto',
          padding: '20px 22px 18px',
          display: 'flex', flexDirection: 'column', gap: 18,
          pointerEvents: 'auto',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', gap: 'var(--space-14)', alignItems: 'flex-start', position: 'relative' }}>
          <div className="u-fill">
            <div style={{
              fontFamily: 'var(--serif)', fontSize: 21, lineHeight: 1.15,
              color: 'var(--text)', marginBottom: 6, letterSpacing: '0.01em',
            }}>
              Немного о куки
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>
              Часть нужна для входа — без них сайт не работает. Ещё сайт собирает обезличенную статистику посещений в Яндекс.Метрике: сколько людей заходит и какие страницы читают.{' '}
              <a href="/privacy#cookies" style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2, fontWeight: 500 }}>
                Подробнее
              </a>
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="u-row10">
          <button onClick={dismiss} className="cookie-btn cookie-btn-accept">
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
