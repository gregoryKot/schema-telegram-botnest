import type { YsqHistoryEntry } from '../../hooks/useYsqTest';

interface ResultHistoryProps {
  history: YsqHistoryEntry[];
}

export function ResultHistory({ history }: ResultHistoryProps) {
  if (history.length < 2) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-sub)',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        История прохождений
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {history.map((entry, idx) => {
          const entryActive = entry.scores.filter(
            (s) => s.pct5plus > 50,
          ).length;
          const prevEntryItem = history[idx + 1];
          const entryDelta = prevEntryItem
            ? entryActive -
              prevEntryItem.scores.filter((s) => s.pct5plus > 50).length
            : null;
          const entryDate = new Date(entry.completedAt).toLocaleDateString(
            'ru-RU',
            {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            },
          );
          return (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                background: 'rgba(var(--fg-rgb),0.04)',
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background:
                    idx === 0 ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.2)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: idx === 0 ? 'var(--text)' : 'var(--text-sub)',
                    fontWeight: idx === 0 ? 600 : 400,
                  }}
                >
                  {entryActive}{' '}
                  {entryActive === 1
                    ? 'схема'
                    : entryActive < 5
                      ? 'схемы'
                      : 'схем'}
                  {idx === 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--accent)',
                        marginLeft: 6,
                      }}
                    >
                      сейчас
                    </span>
                  )}
                </div>
              </div>
              {entryDelta !== null && Math.abs(entryDelta) > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color:
                      entryDelta < 0
                        ? 'var(--accent-green)'
                        : 'var(--accent-red)',
                  }}
                >
                  {entryDelta > 0 ? '+' : ''}
                  {entryDelta}
                </span>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {entryDate}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
