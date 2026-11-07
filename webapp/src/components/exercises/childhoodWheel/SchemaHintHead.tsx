import { CHILDHOOD_SCHEMA_HINTS } from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import type { NeedId } from '../../../../../shared/src/needs/types';
import { NeedArt } from '../../art/NeedArt';
import { DomainMark } from '../../DomainMark';
import { hintDomainId } from './hintDomainId';
import { NEEDS } from './needs';

/** Шапка карточки подсказки: знак потребности, имя, оценка; ниже домен со своим знаком. */
export function SchemaHintHead({ id, score }: { id: NeedId; score: number }) {
  const label = NEEDS.find((n) => n.id === id)?.label ?? id;
  const domainId = hintDomainId(id);
  return (
    <>
      <div className="chw-hint-head">
        <span className="pp-row-art"><NeedArt id={id} size="row" /></span>
        <span className="chw-hint-name">{label}</span>
        <span className="chw-hint-score">{score}/10 в детстве</span>
      </div>
      <div className="chw-hint-domain">
        {domainId && <DomainMark domainId={domainId} />}
        <span>Домен: {CHILDHOOD_SCHEMA_HINTS[id].domain}</span>
      </div>
    </>
  );
}
