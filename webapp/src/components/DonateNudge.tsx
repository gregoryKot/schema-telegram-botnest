import { useEffect, useState } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { Dialog } from './Dialog';
import { EntryBrand, EntryHead } from './paper/EntryHead';
import { DONATE_HUE } from './paper/entryLook';
import { ExternalLink } from '../host/ExternalLink';
import '../styles/sheet-tasks.css';

// Periodic in-app donate nudge (like a soft onboarding reminder). Shows at most
// once every ~30 days, never to a brand-new user (skips the very first session),
// and is fully dismissible. State is a couple of localStorage timestamps.
const SHOWN_KEY = 'donateNudgeAt';
const SEEN_KEY = 'donateNudgeSeen';
const PERIOD = 30 * 24 * 60 * 60 * 1000;

export function DonateNudge({ blocked = false }: { blocked?: boolean } = {}) {
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
    if (!localStorage.getItem(SEEN_KEY)) localStorage.setItem(SEEN_KEY, String(Date.now()));
  }, []);

  if (!show || blocked) return null;

  // Mounted only while the sheet is visible, so useHistorySheet's history push
  // happens exactly once per appearance (not on every app load).
  return <DonateNudgeSheet onClose={() => setShow(false)} />;
}

// Окно входа, а не лист снизу: та же шапка-лист, что у согласий (солома и знак продукта — просьба
// о самом продукте), кольцо автофокуса на «Поддержать» только с клавиатуры (Dialog).
function DonateNudgeSheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const close = () => { localStorage.setItem(SHOWN_KEY, String(Date.now())); goBack(); };
  return (
    <Dialog label="Поддержать проект" onClose={close} closeOnEscape zIndex={200} maxWidth={440}>
      <EntryHead look={{ hue: DONATE_HUE }} art={<EntryBrand />} title="Поддержать проект" />
      <p className="sk-dialog-text sk-nudge-text">
        {tr('«Всё по схеме» бесплатное и без рекламы. Если оно тебе помогает — поддержи развитие любой суммой. Это правда помогает.', '«Всё по схеме» бесплатное и без рекламы. Если оно вам помогает — поддержите развитие любой суммой. Это правда помогает.')}
      </p>
      <ExternalLink href="/donate" onClick={close} className="ds-btn sk-wide-btn sk-nudge-link">
        Поддержать</ExternalLink>
      <button type="button" onClick={close} className="ds-link ef-later">Позже</button>
    </Dialog>
  );
}
