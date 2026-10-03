import { useEffect, useState } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { BottomSheetShell } from './BottomSheetShell';

// Periodic in-app donate nudge (like a soft onboarding reminder). Shows at most
// once every ~30 days, never to a brand-new user (skips the very first session),
// and is fully dismissible. State is a couple of localStorage timestamps.
const SHOWN_KEY = 'donateNudgeAt';
const SEEN_KEY = 'donateNudgeSeen';
const PERIOD = 30 * 24 * 60 * 60 * 1000;

export function DonateNudge() {
  // Показывать ли — выводится на маунте (lazy-init), а не через setState в
  // эффекте (react-hooks/set-state-in-effect). Побочный эффект (пометить
  // brand-new юзера) остаётся в эффекте.
  const [show, setShow] = useState(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) return false; // brand-new — don't nag
    // Give new users a few days before the first nudge.
    if (Date.now() - Number(seen) < 3 * 24 * 60 * 60 * 1000) return false;
    const last = Number(localStorage.getItem(SHOWN_KEY) || 0);
    return Date.now() - last > PERIOD;
  });

  useEffect(() => {
    // Впервые видим юзера — фиксируем момент, чтобы отсчитывать «пару дней».
    if (!localStorage.getItem(SEEN_KEY)) {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    }
  }, []);

  if (!show) return null;

  // Mounted only while the sheet is visible, so useHistorySheet's history push
  // happens exactly once per appearance (not on every app load).
  return <DonateNudgeSheet onClose={() => setShow(false)} />;
}

function DonateNudgeSheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const close = () => { localStorage.setItem(SHOWN_KEY, String(Date.now())); goBack(); };

  return (
    <BottomSheetShell goBack={close} zIndex={200} maxWidth={440}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, color: 'var(--text)', margin: '0 0 8px' }}>Поддержать проект</h2>
        <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.6, margin: '0 0 22px' }}>
          {tr('«Всё по схеме» бесплатное и без рекламы. Если оно тебе помогает — поддержи развитие любой суммой. Это правда помогает.', '«Всё по схеме» бесплатное и без рекламы. Если оно вам помогает — поддержите развитие любой суммой. Это правда помогает.')}
        </p>
        <a href="/donate" onClick={close} style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '14px', fontSize: 16, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-12)', textDecoration: 'none', marginBottom: 10 }}>
          Поддержать
        </a>
        <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', padding: '6px' }}>
          Позже
        </button>
      </div>
    </BottomSheetShell>
  );
}
