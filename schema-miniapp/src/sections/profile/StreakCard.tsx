import { StreakData } from './types';

const DOW = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const TODAY_DOW_IDX = (new Date().getDay() + 6) % 7; // 0=пн ... 6=вс

interface Props {
  streak: StreakData;
  onOpenTracker?: () => void;
}

export function StreakCard({ streak, onOpenTracker }: Props) {
  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;
  const totalDays = streak?.totalDays ?? 0;
  const todayDone = streak?.todayDone ?? false;
  const weekDots = streak?.weekDots ?? [];

  return (
    <div
      className="card"
      style={{ borderRadius: 20, padding: '20px 20px 18px' }}
    >
      {/* Top row: big number + secondary stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-3px',
              color:
                currentStreak > 0
                  ? todayDone
                    ? 'var(--accent)'
                    : 'var(--text)'
                  : 'rgba(var(--fg-rgb),0.2)',
            }}
          >
            {currentStreak > 0 ? currentStreak : '—'}
          </div>
          <div style={{ paddingBottom: 4 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color:
                  currentStreak > 0
                    ? 'var(--text-sub)'
                    : 'rgba(var(--fg-rgb),0.35)',
                lineHeight: 1.2,
              }}
            >
              {currentStreak > 0
                ? currentStreak === 1
                  ? 'день\nподряд'
                  : currentStreak < 5
                    ? 'дня\nподряд'
                    : 'дней\nподряд'
                : totalDays === 0
                  ? 'пока\nне начато'
                  : 'серия\nпрервалась'}
            </div>
          </div>
        </div>

        {/* Secondary stats */}
        <div style={{ display: 'flex', gap: 16, paddingBottom: 4 }}>
          {longestStreak > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: 'var(--text)',
                  lineHeight: 1,
                }}
              >
                {longestStreak}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginTop: 3,
                }}
              >
                рекорд
              </div>
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: 'var(--text)',
                lineHeight: 1,
              }}
            >
              {totalDays}
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginTop: 3,
              }}
            >
              всего
            </div>
          </div>
        </div>
      </div>

      {/* Week bars */}
      {weekDots.length > 0 && (
        <div style={{ display: 'flex', gap: 5 }}>
          {weekDots.map((done, i) => {
            const isToday = i === TODAY_DOW_IDX;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 5,
                    borderRadius: 3,
                    background: done
                      ? isToday
                        ? 'var(--accent)'
                        : 'color-mix(in srgb, var(--accent) 60%, transparent)'
                      : 'rgba(var(--fg-rgb),0.08)',
                    boxShadow:
                      done && isToday
                        ? '0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)'
                        : 'none',
                  }}
                />
                <div
                  style={{
                    fontSize: 9,
                    color: isToday
                      ? 'var(--accent)'
                      : 'rgba(var(--fg-rgb),0.25)',
                    fontWeight: isToday ? 700 : 400,
                  }}
                >
                  {DOW[i]}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA to fill today (streak broken) */}
      {currentStreak === 0 && totalDays > 0 && onOpenTracker && (
        <button
          onClick={onOpenTracker}
          style={{
            marginTop: 14,
            width: '100%',
            padding: '10px 0',
            border: 'none',
            borderRadius: 12,
            background: 'rgba(var(--fg-rgb),0.06)',
            color: 'var(--text-sub)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Заполнить сегодня →
        </button>
      )}
    </div>
  );
}
