import { fmtIndex } from '../../../../shared/src/needs/dayIndex';
import { fmtIndexDelta } from '../../../../shared/src/needs/indexDelta';
import { SignHead } from './SignArt';
import { indexSparkBars, weekDelta } from './clientOverviewModel';

/** `history` — история индекса клиента, index 0 = сегодня. */
interface Props { todayIndex: number; history: readonly { index: number | null }[] }

// «Индекс сегодня» в листе трекера сайдбара «Обзора» (b30): число Literata, как у клиента на «Готово»
// трекера, отличие от недели (weekDelta, ≥7 дней) и столбики за 14 дней (≥3 дня истории) — из реальных
// данных, без заглушек. Без светофора: число и дельта — --text/--text-sub, столбики — одни чернила
// (у клиента индекс не красится в красный и зелёный); пропущенный день — бледный паз.
export function ClientIndexCard({ todayIndex, history }: Props) {
  const bars = history.length >= 3 ? indexSparkBars(history) : [];
  const delta = weekDelta(history, todayIndex);
  return (
    <div className="tk-track-part">
      <SignHead kind="strokes" className="ds-label">Индекс сегодня</SignHead>
      <div className="tk-index">
        <span className="tk-index-num">{fmtIndex(todayIndex)}</span>
        {delta != null && <span className="tk-delta">{fmtIndexDelta(delta)} к нед.</span>}
      </div>
      {bars.length > 0 && (
        <>
          <div className="ds-spark tk-spark" aria-hidden>
            {bars.map((b, i) => (
              <i key={i} className={b.level === 'none' ? 'is-none' : undefined} style={{ height: b.heightPct > 0 ? `${b.heightPct}%` : undefined }} />
            ))}
          </div>
          <div className="ds-sub tk-spark-sub">{bars.length} дн.</div>
        </>
      )}
    </div>
  );
}
