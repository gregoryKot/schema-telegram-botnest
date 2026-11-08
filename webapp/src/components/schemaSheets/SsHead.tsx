import type { CSSProperties, ReactNode } from 'react';
import type { EntityId } from '../../../../shared/src/theme/entityLook';
import { Layers } from '../art/PaperArt';
import { Cluster } from '../art/PaperArtSigns';
import { EntitySheet, type SheetLook } from '../paper/EntitySheet';
import '../../styles/sheet-schemas.css';

/** Шапка листа: eyebrow + заголовок Literata + необязательный подзаголовок.
 *  look — герой редизайна 2026-11: лист бумаги сущности со знаком крупно (EntitySheet; схема —
 *  domainLook, режим — modeGroupLook, YSQ — 'ysq'); art — своя картинка героя, meta — строка из
 *  данных. Без look — прежние шапки: layers — слои у заголовка (схемы, тест YSQ); cluster —
 *  круги (режимы); paperHue — шапка на цветной бумаге с листами над заголовком. */
export function SsHead({ eyebrow, title, lede, center, layers, cluster, paperHue, look, art, meta, compact }: {
  eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; center?: boolean; layers?: boolean; cluster?: boolean; paperHue?: number;
  look?: EntityId | SheetLook; art?: ReactNode; meta?: ReactNode; compact?: boolean;
}) {
  if (look !== undefined) {
    return <EntitySheet look={look} label={eyebrow} title={title} sub={lede} art={art} meta={meta} compact={compact} titleAs="h1" className="ss-hero" />;
  }
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
