import type { ReactNode } from 'react';

// Верхний бар экрана упражнения — один на ExScreen, его силуэт и флешкарты «Мне плохо»
// (FlashcardFrame); до 2026-11 у флешкарт была своя копия (SchemaFlashcardTopbar). Вид —
// общие ds-sheet-head/ds-back (#906). sticky — для прокручиваемого корня .ex2-screen:
// липкость и отступ под статус-бар (.ex2-top, safeTop.test.ts); у флешкарт бар — строка
// грида u-sheet-grid, отступ под статус-бар даёт сам грид.
export function GlyphArrowLeft() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8H3M7 4L3 8l4 4" />
    </svg>
  );
}

export function ExBar({ onBack, label, sticky = false }: { onBack: () => void; label: ReactNode; sticky?: boolean }) {
  return (
    <div className={sticky ? 'ds-sheet-head ex2-top' : 'ds-sheet-head'}>
      <button type="button" className="ds-back" onClick={onBack}><GlyphArrowLeft />{label}</button>
    </div>
  );
}
