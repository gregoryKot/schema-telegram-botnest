// NeedsCard — the 5 mini need indicators card (extracted from TodaySection.tsx).

import { Need } from '../../types';
import { NeedMini } from './NeedMini';

export function NeedsCard({
  needs,
  ratings,
  yesterdayRatings,
  ratedCount,
  allRated,
  onOpenTracker,
  onOpenTrackerAt,
  onOpenTrackerHistory,
}: {
  needs: Need[];
  ratings: Record<string, number>;
  yesterdayRatings: Record<string, number>;
  ratedCount: number;
  allRated: boolean;
  onOpenTracker: () => void;
  onOpenTrackerAt?: (needId: string) => void;
  onOpenTrackerHistory?: () => void;
}) {
  return (
    <div
      className="card"
      onClick={onOpenTrackerHistory}
      style={{
        padding: '18px 18px 14px',
        cursor: onOpenTrackerHistory ? 'pointer' : undefined,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-sub)',
          }}
        >
          Потребности
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {allRated ? 'Готово ✓' : `${ratedCount} / ${needs.length}`}
          </span>
          {onOpenTrackerHistory && (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-faint)"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
        </div>
      </div>

      {/* 5 mini indicators */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        {needs.map((n) => (
          <NeedMini
            key={n.id}
            need={n}
            value={ratings[n.id]}
            yesterday={yesterdayRatings[n.id]}
            onTap={() =>
              onOpenTrackerAt ? onOpenTrackerAt(n.id) : onOpenTracker()
            }
          />
        ))}
      </div>
    </div>
  );
}
