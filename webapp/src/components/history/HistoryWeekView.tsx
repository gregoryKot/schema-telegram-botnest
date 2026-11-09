import type { ReactNode } from 'react';
import type { Need, DayHistory } from '../../types';
import { SparklineRow } from './SparklineRow';
import { AttentionCard } from './AttentionCard';
import { SceneCheckIn } from '../art/LandingScenesMore';
import { checkInBars } from '../art/checkInBars';
import { WEEK_DAYS, weekWindow } from '../../../../shared/src/history/sparkline';
import { isRated } from '../../../../shared/src/needs/ratingRecord';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';

interface Props {
  needs: Need[]; history: DayHistory[]; selectedIdx: number; selectedRatings: Record<string, number>;
  needsLow: Need[]; isTherapist: boolean; bookingLink: ReactNode; onTapNeed: (n: Need) => void; onWeekCard: () => void;
}

/** «Неделя»: линии потребностей за WEEK_DAYS до выбранного дня (та же неделя у «Динамики»), внимание и «Карточка недели» —
 *  сцена: листки отмеченных дней, сверху выбранный день его оценками (checkInBars). */
export function HistoryWeekView({ needs, history, selectedIdx, selectedRatings, needsLow, isTherapist, bookingLink, onTapNeed, onWeekCard }: Props) {
  const weekDays = weekWindow(history, selectedIdx, WEEK_DAYS);
  const ratedDays = weekDays.filter(d => needs.some(n => isRated(d.ratings, n.id))).length;
  return (
    <div className="sd-col">
      <div className="ds-label">За {WEEK_DAYS} дней</div>
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
        <span className="sd-weekcard-scene" aria-hidden="true"><SceneCheckIn hue={ENTITY_LOOK.tracker.hue} days={ratedDays} {...checkInBars(selectedRatings)} /></span>
        <span className="sd-weekcard-label">Карточка недели →</span>
      </button>
    </div>
  );
}
