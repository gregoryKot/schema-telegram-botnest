import { useEffect, useState } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';

// Periodic in-app donate nudge (like a soft onboarding reminder). Shows at most
// once every ~30 days, never to a brand-new user (skips the very first session),
// and is fully dismissible. State is a couple of localStorage timestamps.
const SHOWN_KEY = 'donateNudgeAt';
const SEEN_KEY = 'donateNudgeSeen';
const PERIOD = 30 * 24 * 60 * 60 * 1000;

export function DonateNudge() {
  const tr = useTr();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) { localStorage.setItem(SEEN_KEY, String(Date.now())); return; } // brand-new — don't nag
    // Give new users a few days before the first nudge.
    if (Date.now() - Number(seen) < 3 * 24 * 60 * 60 * 1000) return;
    const last = Number(localStorage.getItem(SHOWN_KEY) || 0);
    if (Date.now() - last > PERIOD) setShow(true);
  }, []);

  if (!show) return null;

  // Mounted only while the sheet is visible, so useHistorySheet's history push
  // happens exactly once per appearance (not on every app load).
  return <DonateNudgeSheet onClose={() => setShow(false)} />;
}

function DonateNudgeSheet({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  const close = () => { localStorage.setItem(SHOWN_KEY, String(Date.now())); goBack(); };

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--bg)', borderRadius: '18px 18px 0 0', padding: '28px 22px calc(28px + env(safe-area-inset-bottom))', textAlign: 'center', boxShadow: '0 -8px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>💛</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, color: 'var(--text)', margin: '0 0 8px' }}>Поддержать проект</h2>
        <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.6, margin: '0 0 22px' }}>
          {tr('«Всё по схеме» бесплатное и без рекламы. Если оно тебе помогает — поддержи развитие любой суммой. Это правда помогает. 🙏', '«Всё по схеме» бесплатное и без рекламы. Если оно вам помогает — поддержите развитие любой суммой. Это правда помогает. 🙏')}
        </p>
        <a href="/donate" onClick={close} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '14px', fontSize: 16, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, textDecoration: 'none', marginBottom: 10 }}>
          Поддержать
        </a>
        <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', padding: '6px' }}>
          Позже
        </button>
      </div>
    </div>
  );
}
