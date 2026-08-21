import type { ReactNode } from 'react';
import { Need, DayHistory } from '../../types';
import { SparklineRow } from './SparklineRow';
import { InsightCard } from './InsightCard';
import { BOOKING_CTA_LABEL } from '../../../../shared/src/history/therapistCta';

// Недельный вид истории: спарклайны по потребностям + инсайт + карточка
// недели. Вынесено из HistoryView.tsx (правило №10).
export function HistoryWeekView({
  needs,
  history,
  selectedIdx,
  selectedRatings,
  days,
  needsLow,
  isTherapist,
  bookingLink,
  onTapNeed,
  onShowWeekCard,
}: {
  needs: Need[];
  history: DayHistory[];
  selectedIdx: number;
  selectedRatings: Record<string, number>;
  days: number;
  needsLow: Need[];
  isTherapist: boolean;
  bookingLink: (label: string) => ReactNode;
  onTapNeed: (need: Need) => void;
  onShowWeekCard: () => void;
}) {
  return (
    <div
      style={{
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div className="section-label" style={{ marginBottom: 4 }}>
        За {days} дней
      </div>

      {needs.map((need) => (
        <SparklineRow
          key={need.id}
          need={need}
          history={history}
          selectedIdx={selectedIdx}
          selectedRatings={selectedRatings}
          onClick={() => onTapNeed(need)}
        />
      ))}

      <InsightCard needs={needs} ratings={selectedRatings} onTap={onTapNeed} />

      {needsLow.length > 0 && (
        <div className="card" style={{ borderRadius: 16, padding: '16px' }}>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.65,
              marginBottom: 10,
            }}
          >
            <strong style={{ color: 'var(--text)' }}>
              {needsLow[0].chartLabel}
            </strong>{' '}
            остаётся низкой несколько дней
            {!isTherapist &&
              ' — разобраться с живым человеком рядом бывает легче'}
            .
          </div>
          {bookingLink(BOOKING_CTA_LABEL)}
        </div>
      )}

      <button
        onClick={() => onShowWeekCard()}
        className="card"
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 16,
          fontFamily: 'inherit',
          color: 'var(--text-sub)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        Карточка недели
      </button>
    </div>
  );
}
