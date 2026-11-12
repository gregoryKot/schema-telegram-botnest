import { CHILDHOOD_SCHEMA_HINTS } from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import type { NeedId } from '../../../../../shared/src/needs/types';
import { NeedArt } from '../../art/NeedArt';
import { DomainArt } from '../../art/DomainArt';
import { hintDomainNum } from './hintDomainId';
import { NEEDS } from './needs';

/**
 * Шапка подсказки: знак потребности — одна колонка слева; имя и оценка — одной строкой с переносом
 * (на 320 «Привязанность» не лезет под «4/10 в детстве», оценка уходит строкой ниже), под ними —
 * домен со знаком строчкой меню (nav).
 */
export function SchemaHintHead({ id, score }: { id: NeedId; score: number }) {
  const label = NEEDS.find((n) => n.id === id)?.label ?? id;
  const domain = hintDomainNum(id);
  return (
    <div className="chw-hint-head">
      <span className="pp-row-art chw-hint-sign" aria-hidden="true"><NeedArt id={id} size="row" /></span>
      <span className="chw-hint-title">
        <span className="chw-hint-name">{label}</span>
        <span className="chw-hint-score">{score}/10 в детстве</span>
      </span>
      <span className="chw-hint-domain">
        {domain > 0 && <span className="chw-hint-domain-art" aria-hidden="true"><DomainArt domain={domain} size="nav" /></span>}
        <span>Домен: {CHILDHOOD_SCHEMA_HINTS[id].domain}</span>
      </span>
    </div>
  );
}
