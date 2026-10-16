import type { ReactNode } from 'react';
import '../../styles/sheet-schemas.css';
import { GlyphArrowLeft } from '../exercises/ExScreen';

interface Props {
  onBack: () => void;
  backLabel?: string;
  zIndex?: number;
  barRight?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}

/** Оболочка листа схем/режимов: верхняя полоса с «Назад» + прокручиваемое тело. */
export function SsSheet({ onBack, backLabel = 'Назад', zIndex, barRight, narrow, children }: Props) {
  return (
    <div className="ss-sheet" style={zIndex ? { zIndex } : undefined}>
      <div className="ss-bar">
        <button className="ds-link ss-back" onClick={onBack}>
          <GlyphArrowLeft /> {backLabel}
        </button>
        {barRight}
      </div>
      <div className="ss-scroll">
        <div className={`ss-inner${narrow ? ' ss-inner--narrow' : ''}`}>{children}</div>
      </div>
    </div>
  );
}

/** Шапка листа: eyebrow + заголовок Literata + необязательный подзаголовок. */
export function SsHead({ eyebrow, title, lede, center }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; center?: boolean }) {
  return (
    <div className={`ss-head${center ? ' ss-head--center' : ''}`}>
      {eyebrow && <div className="ds-eyebrow">{eyebrow}</div>}
      <h1 className="ss-title">{title}</h1>
      {lede && <p className="ss-lede">{lede}</p>}
    </div>
  );
}
