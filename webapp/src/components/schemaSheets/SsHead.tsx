import type { CSSProperties, ReactNode } from 'react';
import { Layers } from '../art/PaperArt';
import '../../styles/sheet-schemas.css';

/** Шапка листа: eyebrow + заголовок Literata + необязательный подзаголовок.
 *  layers — слои у заголовка (схемы, тест YSQ); paperHue — шапка на цветной бумаге с листами над заголовком. */
export function SsHead({ eyebrow, title, lede, center, layers, paperHue }: {
  eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; center?: boolean; layers?: boolean; paperHue?: number;
}) {
  const paper = paperHue !== undefined;
  return (
    <div className={`ss-head${center ? ' ss-head--center' : ''}${paper ? ' pp-paper ss-head--paper' : ''}`}
      style={paper ? ({ '--h': paperHue } as CSSProperties) : undefined}>
      {paper && <Layers size="square" />}
      {eyebrow && <div className="ds-eyebrow">{eyebrow}</div>}
      {layers && !paper
        ? <div className="ss-title-row"><h1 className="ss-title">{title}</h1><Layers size="row" /></div>
        : <h1 className="ss-title">{title}</h1>}
      {lede && <p className="ss-lede">{lede}</p>}
    </div>
  );
}
