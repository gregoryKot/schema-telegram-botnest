import {
  weekBars,
  type BarTone,
} from '../../../../shared/src/pair/partnerCard';

// Тон (логика и пороги — shared/src/pair/partnerCard.ts) → цвет палитры.
export const TONE_COLOR: Record<BarTone, string> = {
  good: 'var(--accent-green)',
  mid: 'var(--accent-yellow)',
  low: 'var(--accent-red)',
  none: 'rgba(var(--fg-rgb),0.08)',
};

// Недельные столбики партнёра: слева старое, справа сегодня (подпись «сег»).
export function WeekBars({ avgs }: { avgs: (number | null)[] }) {
  const bars = weekBars(avgs);
  if (bars.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'flex-end',
        height: 28,
        marginBottom: 10,
      }}
    >
      {bars.map((bar, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
        >
          <div
            style={{
              width: '100%',
              height: bar.px,
              borderRadius: 'var(--r-4)',
              background: TONE_COLOR[bar.tone],
              transition: 'height 0.3s',
            }}
          />
          {bar.today && (
            <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>сег</div>
          )}
        </div>
      ))}
    </div>
  );
}
