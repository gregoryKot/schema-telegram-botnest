import { indexLevel } from '../../lib/tone';
import { indexSparkBars, weekDelta } from './clientOverviewModel';

interface Props {
  todayIndex: number;
  /** История индекса клиента, index 0 = сегодня. */
  history: readonly { index: number | null }[];
}

// «Индекс сегодня» в сайдбаре «Обзора»: число с уровнем, отличие от недели
// (weekDelta — только при ≥7 днях) и столбики за 14 дней (только при ≥3 днях
// истории) — всё из реальных данных клиента, без заглушек.
export function ClientIndexCard({ todayIndex, history }: Props) {
  const bars = history.length >= 3 ? indexSparkBars(history) : [];
  const delta = weekDelta(history, todayIndex);
  return (
    <div className="ds-card ds-card--row">
      <h2 className="ds-label">Индекс сегодня</h2>
      <div className="tk-index">
        <span className={`ds-num ds-idx-${indexLevel(todayIndex)}`}>{todayIndex.toFixed(1)}</span>
        {delta != null && (
          <span className={`tk-delta ${delta >= 0 ? 'ds-idx-ok' : 'ds-idx-err'}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} к нед.</span>
        )}
      </div>
      {bars.length > 0 && (
        <>
          <div className="ds-spark" aria-hidden>
            {bars.map((b, i) => (
              <i key={i} className={b.level === 'none' ? undefined : `is-${b.level}`} style={{ height: b.heightPct > 0 ? `${b.heightPct}%` : undefined }} />
            ))}
          </div>
          <div className="ds-sub tk-spark-sub">{bars.length} дн.</div>
        </>
      )}
    </div>
  );
}
