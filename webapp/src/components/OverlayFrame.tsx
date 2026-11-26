import type { ReactNode } from 'react';
import { GlyphArrowLeft } from './exercises/ExScreen';
import '../styles/sheet-tasks.css';

/** Каркас оверлеев «Задания» / «Все цели»: верхняя полоса «Назад» + страница; шапку (лист-герой с заголовком) рисует экран. */
export function OverlayFrame({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="sk-overlay">
      <div className="ds-sheet-head"><button type="button" className="ds-back" onClick={onBack}><GlyphArrowLeft /> Назад</button></div>
      <div className="sk-scroll">
        <div className="sk-page sk-page--tasks">{children}</div>
      </div>
    </div>
  );
}
