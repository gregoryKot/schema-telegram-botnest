// "Потребности" (Needs) card: mini indicator grid + average score / rate CTA.

import { Need } from '../../types';
import { NeedMini } from './NeedMini';

export function NeedsCard({
  needs,
  ratings,
  yesterdayRatings,
  onOpenTracker,
  onOpenTrackerAt,
  onOpenTrackerHistory,
  ratedCount,
  allRated,
  avgScore,
}: {
  needs: Need[];
  ratings: Record<string, number>;
  yesterdayRatings: Record<string, number>;
  onOpenTracker: () => void;
  onOpenTrackerAt?: (needId: string) => void;
  onOpenTrackerHistory?: () => void;
  ratedCount: number;
  allRated: boolean;
  avgScore: string | null;
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

      {/* Primary CTA */}
      {allRated && avgScore ? (
        (() => {
          const sc = parseFloat(avgScore);
          const scoreColor =
            sc >= 7
              ? 'var(--accent-green)'
              : sc >= 4
                ? 'var(--accent-yellow)'
                : 'var(--accent-red)';
          const scoreLabel =
            sc >= 7
              ? 'Хороший день'
              : sc >= 4
                ? 'Средний день'
                : 'Сложный день';
          return (
            <div
              style={{
                background: 'var(--surface-2)',
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-faint)',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: 2,
                  }}
                >
                  Средний индекс
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: '-1.5px',
                    color: scoreColor,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {avgScore}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: scoreColor,
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  {scoreLabel}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTrackerHistory?.();
                }}
                style={{
                  background:
                    'color-mix(in srgb, var(--accent) 10%, transparent)',
                  border:
                    '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <span>📊</span>
                <span>История</span>
              </button>
            </div>
          );
        })()
      ) : (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenTracker();
          }}
          style={{
            borderRadius: 14,
            padding: '12px 14px',
            cursor: 'pointer',
            background:
              'color-mix(in srgb, var(--accent) 8%, var(--surface-2))',
            border:
              '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--accent)',
              }}
            >
              Оценить потребности
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-faint)',
                marginTop: 2,
              }}
            >
              Займёт 2 минуты
            </div>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      )}
    </div>
  );
}
