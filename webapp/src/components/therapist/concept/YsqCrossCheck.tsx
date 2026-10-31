import { useState } from 'react';
import type { YsqHistoryEntry } from '../../../../../shared/src/apiTypes';
import { crossCheckItems } from './ysqCrossCheck';

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
    <div className="u-col8" style={{ marginTop: 12 }}>
      {shown.map(it => (
        <div key={it.id} className="u-ac8">
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{it.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{it.valueLabel}</span>
          {!it.inConcept && <span style={{ fontSize: 11, color: 'var(--c-amber)', fontWeight: 500 }}>+ добавить?</span>}
        </div>
      ))}
      {items.length > SHOWN && (
        <button type="button" className="ds-link" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => setAll(a => !a)}>
          {all ? 'Свернуть' : `Ещё ${items.length - SHOWN}`}
        </button>
      )}
    </div>
  );
}
