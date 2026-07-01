import { useEffect, useState } from 'react';

// Periodic in-app donate nudge: shows at most once every ~30 days, skips the
// very first session + first 3 days, fully dismissible. Opens the donate page
// via Telegram's openLink so it works inside the mini-app.
const SHOWN_KEY = 'donateNudgeAt';
const SEEN_KEY = 'donateNudgeSeen';
const DAY = 24 * 60 * 60 * 1000;

export function DonateNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) { localStorage.setItem(SEEN_KEY, String(Date.now())); return; }
    if (Date.now() - Number(seen) < 3 * DAY) return;
    const last = Number(localStorage.getItem(SHOWN_KEY) || 0);
    if (Date.now() - last > 30 * DAY) setShow(true);
  }, []);

  const close = () => { localStorage.setItem(SHOWN_KEY, String(Date.now())); setShow(false); };
  const donate = () => {
    const url = 'https://schemehappens.ru/donate';
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(url); else window.open(url, '_blank');
    close();
  };

  if (!show) return null;

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--bg)', borderRadius: '18px 18px 0 0', padding: '28px 22px calc(28px + env(safe-area-inset-bottom))', textAlign: 'center', boxShadow: '0 -8px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>💛</div>
        <div style={{ fontFamily: 'var(--serif, inherit)', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Поддержать проект</div>
        <div style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 22 }}>
          «Всё по схеме» бесплатное и без рекламы. Если оно тебе помогает — поддержи развитие любой суммой. 🙏
        </div>
        <button onClick={donate} style={{ width: '100%', padding: '14px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', marginBottom: 10 }}>
          Поддержать
        </button>
        <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', padding: '6px' }}>
          Позже
        </button>
      </div>
    </div>
  );
}
