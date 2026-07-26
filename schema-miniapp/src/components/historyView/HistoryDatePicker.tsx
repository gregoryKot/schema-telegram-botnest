import type { RefObject } from 'react';
import { Need, DayHistory } from '../../types';
import { getDayAbbr, getDayNum, dayAvg } from './constants';

// Горизонтальная лента дней истории. Вынесено из HistoryView.tsx (правило №10).
export function HistoryDatePicker({
  history,
  needs,
  selectedIdx,
  onSelect,
  dateBtnRefs,
}: {
  history: DayHistory[];
  needs: Need[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  dateBtnRefs: RefObject<(HTMLButtonElement | null)[]>;
}) {
  return (
    <div
      style={{
        overflowX: 'auto',
        scrollbarWidth: 'none',
        padding: '0 16px 16px',
      }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        {history.map((day, i) => {
          const active = i === selectedIdx;
          const avg = dayAvg(day, needs);
          const hasData = avg !== null;
          const barColor = !hasData
            ? 'rgba(var(--fg-rgb),0.1)'
            : avg >= 7
              ? 'var(--accent-green)'
              : avg >= 4
                ? 'var(--accent-yellow)'
                : 'var(--accent-red)';
          const barW = hasData ? Math.round((avg / 10) * 100) : 0;

          return (
            <button
              key={day.date}
              ref={(el) => {
                dateBtnRefs.current[i] = el;
              }}
              onClick={() => onSelect(i)}
              style={{
                flexShrink: 0,
                width: 44,
                padding: '8px 0 10px',
                border: 'none',
                borderRadius: 14,
                fontFamily: 'inherit',
                cursor: 'pointer',
                textAlign: 'center',
                background: active
                  ? 'var(--accent)'
                  : 'rgba(var(--fg-rgb),0.05)',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: active
                    ? 'rgba(255,255,255,0.75)'
                    : 'var(--text-faint)',
                }}
              >
                {getDayAbbr(day.date)}
              </span>
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: active ? '#fff' : 'var(--text)',
                }}
              >
                {getDayNum(day.date)}
              </span>
              {/* Mini score bar */}
              <div
                style={{
                  width: 24,
                  height: 3,
                  borderRadius: 2,
                  background: active
                    ? 'rgba(255,255,255,0.25)'
                    : 'rgba(var(--fg-rgb),0.08)',
                  overflow: 'hidden',
                }}
              >
                {hasData && (
                  <div
                    style={{
                      width: `${barW}%`,
                      height: '100%',
                      borderRadius: 2,
                      background: active ? '#fff' : barColor,
                    }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
