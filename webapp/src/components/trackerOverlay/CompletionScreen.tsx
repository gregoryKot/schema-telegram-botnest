import type { Need } from '../../types';
import { DayShareButton } from '../../share/DayShareButton';

export function CompletionScreen({
  needs,
  effectiveRatings,
  isBackfill,
  date,
  onDone,
  goBack,
}: {
  needs: Need[];
  effectiveRatings: Record<string, number>;
  isBackfill: boolean;
  /** Дата backfill-дня (YYYY-MM-DD); undefined = сегодня */
  date?: string;
  onDone?: () => void;
  goBack: () => void;
}) {
  const allVals = needs.map((n) => effectiveRatings[n.id] ?? 0);
  const avgIdx = allVals.reduce((a, b) => a + b, 0) / allVals.length;
  return (
    <div className="tk2-overlay tk2-done">
      <div className="ds-card ds-card--ink tk2-done-card">
        <div className="tk2-done-mark">✓</div>
        <h2 className="ds-h2">Заполнено</h2>
        <div>
          <span className="ds-num tk2-done-idx">{avgIdx.toFixed(1)}</span>
          <span className="tk2-done-unit">/10</span>
        </div>
        <div className="ds-label tk2-done-cap">индекс дня</div>
        <div className="tk2-done-acts">
          <button onClick={isBackfill ? (onDone ?? goBack) : goBack} className="ds-btn tk2-done-btn">
            Готово
          </button>
          <DayShareButton needs={needs} ratings={effectiveRatings} date={date} />
        </div>
      </div>
    </div>
  );
}
