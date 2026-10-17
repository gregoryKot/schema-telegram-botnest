import type { ReactNode } from 'react';
import type { Need, DayHistory } from '../../types';
import { SparklineRow } from './SparklineRow';

interface Props {
  needs: Need[];
  history: DayHistory[];
  days: number;
  selectedIdx: number;
  selectedRatings: Record<string, number>;
  needsLow: Need[];
  isTherapist: boolean;
  bookingLink: ReactNode;
  onTapNeed: (n: Need) => void;
  onWeekCard: () => void;
}

/** Вид «Неделя»: линии потребностей за период + карточка недели. */
export function HistoryWeekView({ needs, history, days, selectedIdx, selectedRatings, needsLow, isTherapist, bookingLink, onTapNeed, onWeekCard }: Props) {
  return (
    <div className="sd-col">
      <div className="ds-label">За {days} дней</div>
      <div className="ds-card ds-card--flush">
        {needs.map(need => (
          <SparklineRow key={need.id} need={need} history={history}
            selectedIdx={selectedIdx} selectedRatings={selectedRatings}
            onClick={() => onTapNeed(need)} />
        ))}
      </div>

      {needsLow.length > 0 && (
        <div className="ds-card ds-card--row">
          <div className="sd-low-text">
            <strong>{needsLow[0].chartLabel}</strong> остаётся низкой несколько дней{!isTherapist && ' – разобраться рядом с живым человеком бывает легче'}.
          </div>
          {bookingLink}
        </div>
      )}

      <button onClick={onWeekCard} className="ds-btn ds-btn--secondary">Карточка недели →</button>
    </div>
  );
}
