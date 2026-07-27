import { DAYS_OPTIONS } from './constants';

// Переключатели «День/Неделя» и глубины истории. Вынесено из
// HistoryView.tsx (правило №10).
export function HistoryControls({
  subView,
  onSubView,
  days,
  onChangeDays,
}: {
  subView: 'day' | 'week';
  onSubView: (v: 'day' | 'week') => void;
  days: number;
  onChangeDays?: (days: number) => void;
}) {
  return (
    <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
      {/* Day / Week toggle */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          background: 'rgba(var(--fg-rgb),0.06)',
          borderRadius: 12,
          padding: 3,
        }}
      >
        {(['day', 'week'] as const).map((v) => {
          const active = subView === v;
          return (
            <button
              key={v}
              onClick={() => onSubView(v)}
              style={{
                flex: 1,
                padding: '7px 0',
                border: 'none',
                borderRadius: 10,
                fontFamily: 'inherit',
                background: active ? 'var(--surface)' : 'transparent',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                color: active ? 'var(--text)' : 'var(--text-faint)',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {v === 'day' ? 'День' : 'Неделя'}
            </button>
          );
        })}
      </div>

      {/* Depth */}
      {onChangeDays && (
        <div
          style={{
            display: 'flex',
            background: 'rgba(var(--fg-rgb),0.06)',
            borderRadius: 12,
            padding: 3,
          }}
        >
          {DAYS_OPTIONS.map((d) => {
            const active = days === d;
            return (
              <button
                key={d}
                onClick={() => onChangeDays(d)}
                style={{
                  padding: '7px 10px',
                  border: 'none',
                  borderRadius: 10,
                  fontFamily: 'inherit',
                  background: active ? 'var(--surface)' : 'transparent',
                  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  color: active ? 'var(--text)' : 'var(--text-faint)',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {d}д
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
