import { avgBarPct, countActiveInHistory, type SchemaInfo, type YsqHistoryEntry } from '../../hooks/useYsqTest';

/** Свёрнутый список неактивных схем с мини-барами («на грани» — тёплым). */
export function YsqInactiveList({ schemas, scores, expanded, onToggle }: {
  schemas: SchemaInfo[];
  scores: Record<string, { avg: number }>;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="ss-res">
      <button onClick={onToggle} aria-expanded={expanded} className="ds-btn ds-btn--secondary ss-toggle">
        <span>Остальные схемы ({schemas.length})</span>
        <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && schemas.map(schema => {
        const { avg } = scores[schema.name];
        return (
          <div key={schema.name} className={`ss-mini${avg >= 3 ? ' is-mid' : ''}`}>
            <div className="ss-mini-top">
              <span>{schema.name}</span>
              <b>{avg} из 6</b>
            </div>
            <div className="ss-mini-track"><span style={{ width: `${avgBarPct(avg)}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

const schemaWord = (n: number) => (n === 1 ? 'схема' : n < 5 ? 'схемы' : 'схем');

/** История прохождений: сколько схем было выражено и как менялось. */
export function YsqHistory({ history }: { history: YsqHistoryEntry[] }) {
  return (
    <div className="ss-res">
      <div className="ds-eyebrow">История прохождений</div>
      {history.map((entry, idx) => {
        const active = countActiveInHistory(entry);
        const prev = history[idx + 1];
        const delta = prev ? active - countActiveInHistory(prev) : null;
        const date = new Date(entry.completedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
        return (
          <div key={entry.id} className={`ss-hist${idx === 0 ? ' is-now' : ''}`}>
            <span className="ds-dot" />
            <span className="ss-hist-grow">
              {active} {schemaWord(active)}
              {idx === 0 && <span className="ds-sub"> · сейчас</span>}
            </span>
            {delta !== null && delta !== 0 && (
              <span className={`ss-delta ${delta < 0 ? 'is-down' : 'is-up'}`}>{delta > 0 ? '+' : ''}{delta}</span>
            )}
            <span className="ds-sub">{date}</span>
          </div>
        );
      })}
    </div>
  );
}
