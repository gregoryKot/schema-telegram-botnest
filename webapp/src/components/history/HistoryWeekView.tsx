import type { ReactNode } from 'react';
import type { Need, DayHistory } from '../../types';
import { SparklineRow } from './SparklineRow';
import { AttentionCard } from './AttentionCard';
import { SceneCheckIn } from '../art/LandingScenesMore';
import { weekWindow } from '../../../../shared/src/history/sparkline';
import { isRated } from '../../../../shared/src/needs/ratingRecord';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';

interface Props {
  needs: Need[]; history: DayHistory[]; days: number; selectedIdx: number; selectedRatings: Record<string, number>;
  needsLow: Need[]; isTherapist: boolean; bookingLink: ReactNode; onTapNeed: (n: Need) => void; onWeekCard: () => void;
}

/** Вид «Неделя»: линии потребностей за N дней до выбранного (на компьютере — карточки на бумаге
 *  потребностей), внимание и «Карточка недели» строкой со сценой листков отмеченных дней. */
export function HistoryWeekView({ needs, history, days, selectedIdx, selectedRatings, needsLow, isTherapist, bookingLink, onTapNeed, onWeekCard }: Props) {
  const weekDays = weekWindow(history, selectedIdx, days);
  const ratedDays = weekDays.filter(d => needs.some(n => isRated(d.ratings, n.id))).length;
  return (
    <div className="sd-col">
      <div className="ds-label">За {days} дней</div>
      <div className="ds-card ds-card--flush sd-week">
        {needs.map(need => (
          <SparklineRow key={need.id} need={need} days={weekDays} selectedRatings={selectedRatings} onClick={() => onTapNeed(need)} />
        ))}
      </div>
      {needsLow.length > 0 && (
        <AttentionCard need={needsLow[0]}>
          <div className="sd-low-text">
            <strong>{needsLow[0].chartLabel}</strong> остаётся низкой несколько дней{!isTherapist && glue(' – разобраться рядом с живым человеком бывает легче')}.
          </div>
          {bookingLink}
        </AttentionCard>
      )}
      <button type="button" onClick={onWeekCard} className="ds-card ds-card--row ds-card--hover sd-weekcard">
        <span className="sd-weekcard-scene" aria-hidden="true"><SceneCheckIn hue={ENTITY_LOOK.tracker.hue} days={ratedDays} /></span>
        <span className="sd-weekcard-label">Карточка недели →</span>
      </button>
    </div>
  );
}
