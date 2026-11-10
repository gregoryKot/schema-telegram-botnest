import type { ReactNode } from 'react';
import { SignArt } from '../art/SignArt';
import '../../styles/sheet-schemas.css';

/** Шапка белой карточки совета: знак Leaf строкой и подпись — «Что помогает» в чек-ине режима, «Что питает» и
 *  «Что поможет сейчас» на листе потребности. Одна разметка и одно правило (.ss-tip-head, schema-library.css)
 *  на оба листа (ревью g5 r2). */
export function TipHead({ children }: { children: ReactNode }) {
  return (
    <div className="ss-tip-head">
      <span className="pp-row-art" aria-hidden="true"><SignArt sign="leaf" size="row" /></span>
      <div className="ds-label">{children}</div>
    </div>
  );
}
