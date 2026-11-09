import { indexLevel } from '../../lib/tone';
import { fmtIndex, fmtIndexDelta } from '../../../../shared/src/needs/dayIndex';
import { SignHead } from './SignArt';
import { indexSparkBars, weekDelta } from './clientOverviewModel';

interface Props {
  todayIndex: number;
  /** История индекса клиента, index 0 = сегодня. */
  history: readonly { index: number | null }[];
}

// «Индекс сегодня» в сайдбаре «Обзора»: число с уровнем, отличие от недели (weekDelta — при ≥7
// днях) и столбики за 14 дней (при ≥3 днях истории) — из реальных данных клиента, без заглушек.
export function ClientIndexCard({ todayIndex, history }: Props) {
  const bars = history.length >= 3 ? indexSparkBars(history) : [];
  const delta = weekDelta(history, todayIndex);
  return (
    <div className="ds-card ds-card--row">
      <SignHead kind="strokes" className="ds-label">Индекс сегодня</SignHead>
      <div className="tk-index">
        <span className={`ds-num ds-idx-${indexLevel(todayIndex)}`}>{fmtIndex(todayIndex)}</span>
        {delta != null && (
          <span className={`tk-delta ${delta >= 0 ? 'ds-idx-ok' : 'ds-idx-err'}`}>{fmtIndexDelta(delta)} к нед.</span>
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
