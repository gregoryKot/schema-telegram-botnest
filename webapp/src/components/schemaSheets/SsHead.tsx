import type { CSSProperties, ReactNode } from 'react';
import { Layers } from '../art/PaperArt';
import { Cluster } from '../art/PaperArtSigns';
import '../../styles/sheet-schemas.css';

/** Шапка листа: eyebrow + заголовок Literata + необязательный подзаголовок.
 *  layers — слои у заголовка (схемы, тест YSQ); cluster — круги (режимы); paperHue — шапка на цветной бумаге с листами над заголовком. */
export function SsHead({ eyebrow, title, lede, center, layers, cluster, paperHue }: {
  eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; center?: boolean; layers?: boolean; cluster?: boolean; paperHue?: number;
}) {
  const paper = paperHue !== undefined;
  return (
    <div className={`ss-head${center ? ' ss-head--center' : ''}${paper ? ' pp-paper ss-head--paper' : ''}`}
      style={paper ? ({ '--h': paperHue } as CSSProperties) : undefined}>
      {paper && <Layers size="square" />}
      {eyebrow && <div className="ds-eyebrow">{eyebrow}</div>}
      {(layers || cluster) && !paper
        ? <div className="ss-title-row"><h1 className="ss-title">{title}</h1>{layers ? <Layers size="row" /> : <Cluster size="row" />}</div>
        : <h1 className="ss-title">{title}</h1>}
      {lede && <p className="ss-lede">{lede}</p>}
    </div>
  );
}
