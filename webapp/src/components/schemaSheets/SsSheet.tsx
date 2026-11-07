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
      <div className="ds-sheet-head">
        <button type="button" className="ds-back" onClick={onBack}>
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

export { SsHead } from './SsHead';
