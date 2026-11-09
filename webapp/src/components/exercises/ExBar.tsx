import type { ReactNode } from 'react';
import { GlyphArrowLeft } from './ExGlyphs';

// Верхний бар экрана упражнения — один на ExScreen, его силуэт и флешкарты «Мне плохо»
// (FlashcardFrame); до 2026-11 у флешкарт была своя копия (SchemaFlashcardTopbar). Вид —
// общие ds-sheet-head/ds-back (#906). sticky — для прокручиваемого корня .ex2-screen:
// липкость и отступ под статус-бар (.ex2-top, safeTop.test.ts); у флешкарт бар — строка
// грида u-sheet-grid, отступ под статус-бар даёт сам грид. Стрелка — из ExGlyphs (дом всех глифов).

export function ExBar({ onBack, label, sticky = false }: { onBack: () => void; label: ReactNode; sticky?: boolean }) {
  return (
    <div className={sticky ? 'ds-sheet-head ex2-top' : 'ds-sheet-head'}>
      <button type="button" className="ds-back" onClick={onBack}><GlyphArrowLeft />{label}</button>
    </div>
  );
}
