// DiaryCard — recent diary entries preview (extracted from TodaySection.tsx).

import { SkeletonLines } from './SkeletonLines';
import { DiaryTypeBadge } from './DiaryTypeBadge';

export interface RecentDiary {
  type: string;
  label: string;
  time: string;
  dateStr: string;
}

export function DiaryCard({
  diariesLoaded,
  recentDiaries,
  onOpenDiaries,
  onSetGoal,
}: {
  diariesLoaded: boolean;
  recentDiaries: RecentDiary[];
  onOpenDiaries: () => void;
  onSetGoal: () => void;
}) {
  return (
    <div
      onClick={onOpenDiaries}
      className="card"
      style={{
        padding: '18px 18px 14px',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
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
          Дневник
        </div>
        <span
          style={{
            fontSize: 12,
            color: 'var(--accent)',
            fontWeight: 500,
          }}
        >
          Все →
        </span>
      </div>

      {!diariesLoaded ? (
        <SkeletonLines />
      ) : recentDiaries.length > 0 ? (
        recentDiaries.map((entry, i) => {
          const typeColor =
            (
              {
                schema: '#818cf8',
                mode: '#f472b6',
                gratitude: '#4ade80',
              } as Record<string, string>
            )[entry.type] ?? '#aaa';
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 0',
                borderTop: i > 0 ? '1px solid var(--border-color)' : undefined,
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 36,
                  borderRadius: 4,
                  flexShrink: 0,
                  background: typeColor,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-sub)',
                    marginTop: 2,
                  }}
                >
                  {entry.dateStr}
                  {entry.time ? ` · ${entry.time}` : ''}
                </div>
              </div>
              <DiaryTypeBadge type={entry.type} />
            </div>
          );
        })
      ) : (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.55,
          }}
        >
          Замечать моменты, когда схемы активируются — главная практика
        </div>
      )}

      <div
        style={{
          paddingTop: 10,
          marginTop: 2,
          borderTop: '1px solid var(--border-color)',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSetGoal();
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 12,
            color: 'var(--accent)',
            cursor: 'pointer',
            fontWeight: 500,
            fontFamily: 'inherit',
          }}
        >
          + Поставить цель на дневник
        </button>
      </div>
    </div>
  );
}
