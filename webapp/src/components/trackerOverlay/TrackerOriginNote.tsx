// Строка «откуда это» над первым вопросом трекера (правило «Онбординг и
// очевидность»). Вместо трёх карточек: остальное видно на самом экране.
// Показывается, пока нет ни одной оценки и флаг не стоит (localStorage, как в мини-аппе).
import { useState } from 'react';
import { TRACKER_ONBOARDING_KEY, TRACKER_ORIGIN_NOTE } from '../../../../shared/src/needs/trackerOnboarding';

// Приватный режим: хранилища нет — строка покажется ещё раз, это не ошибка.
const seen = (): boolean => {
  try { return !!localStorage.getItem(TRACKER_ONBOARDING_KEY); } catch { return false; }
};
const remember = (): void => {
  try { localStorage.setItem(TRACKER_ONBOARDING_KEY, '1'); } catch { return; }
};

export function TrackerOriginNote({ eligible }: { eligible: boolean }) {
  // «Показывать» решается при открытии; дальше строку прячет только `eligible=false` (ушли с первого вопроса) или «Понятно».
  const [open, setOpen] = useState(() => eligible && !seen());
  if (!open || !eligible) return null;
  const dismiss = () => {
    remember();
    setOpen(false);
  };
  return (
    <div className="tq-note" role="note">
      <span>{TRACKER_ORIGIN_NOTE}</span>
      <button type="button" className="tq-note-x" onClick={dismiss}>Понятно</button>
    </div>
  );
}
