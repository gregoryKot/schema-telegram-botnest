import type { ReactNode } from 'react';
import { GlyphArrowLeft } from './exercises/ExScreen';
import '../styles/sheet-tasks.css';

/** Каркас оверлеев «Все задания» / «Все цели»: верхняя полоса «Назад» + колонка со списком. */
export function OverlayFrame({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="sk-overlay">
      <div className="sk-top"><button className="ds-link sk-back" onClick={onBack}><GlyphArrowLeft /> Назад</button></div>
      <div className="sk-scroll">
        <div className="sk-page sk-page--narrow">
          <h1 className="ds-h2">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
