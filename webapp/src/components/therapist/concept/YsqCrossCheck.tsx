import { useState } from 'react';
import type { YsqHistoryEntry } from '../../../../../shared/src/apiTypes';
import { crossCheckItems } from './ysqCrossCheckModel';

const SHOWN = 6;

// «Сверка с YSQ» в раскрывашке под концептуализацией (ConceptFoldouts — она же
// несёт заголовок): выраженные по YSQ схемы по убыванию выраженности; больше
// шести — «ещё N», а не молчаливая обрезка.
export function YsqCrossCheck({ ysqActiveIds, latest, conceptSchemaIds }: {
  ysqActiveIds: string[];
  latest: YsqHistoryEntry | undefined;
  conceptSchemaIds: string[];
}) {
  const [all, setAll] = useState(false);
  const items = crossCheckItems(ysqActiveIds, latest, conceptSchemaIds);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <div className="u-col8">
      {shown.map(it => (
        <div key={it.id} className="u-ac8">
          <span className="u-fill">{it.name}</span>
          <span className="ds-sub">{it.valueLabel}</span>
          {!it.inConcept && <span className="ds-badge ds-badge--warn">+ добавить?</span>}
        </div>
      ))}
      {items.length > SHOWN && (
        <button type="button" className="ds-link u-self-start tcp-ysq-more" onClick={() => setAll(a => !a)}>
          {all ? 'Свернуть' : `Ещё ${items.length - SHOWN}`}
        </button>
      )}
    </div>
  );
}
