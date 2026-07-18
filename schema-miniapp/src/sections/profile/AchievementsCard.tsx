import { Achievement } from '../../api';
import { ACHIEVEMENT_META } from './constants';

interface Props {
  achievements: Achievement[];
  earnedList: Achievement[];
  onOpen: () => void;
}

export function AchievementsCard({ achievements, earnedList, onOpen }: Props) {
  return (
    <div
      onClick={onOpen}
      className="card"
      style={{
        borderRadius: 20,
        padding: '16px 0 16px 16px',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          paddingRight: 16,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          Достижения
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
            {earnedList.length} из {achievements.length}
          </span>
          <span style={{ fontSize: 15, color: 'var(--text-faint)' }}>›</span>
        </div>
      </div>

      {earnedList.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            paddingRight: 16,
          }}
        >
          Первое — за первую запись в дневник
        </div>
      ) : (
        /* Horizontal scroll of earned achievements */
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingRight: 16,
            paddingBottom: 2,
          }}
        >
          {earnedList.map((a) => {
            const m = ACHIEVEMENT_META[a.id];
            if (!m) return null;
            return (
              <div
                key={a.id}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 12px',
                  borderRadius: 14,
                  background:
                    'color-mix(in srgb, var(--accent) 9%, transparent)',
                  border:
                    '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                  minWidth: 64,
                }}
              >
                <span style={{ fontSize: 26 }}>{m.emoji}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-sub)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.title}
                </span>
              </div>
            );
          })}
          {/* Locked preview */}
          {achievements.filter((a) => !a.earned).length > 0 && (
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 14,
                background: 'rgba(var(--fg-rgb),0.04)',
                border: '1px solid rgba(var(--fg-rgb),0.06)',
                minWidth: 64,
              }}
            >
              <span style={{ fontSize: 20, opacity: 0.25 }}>🔒</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                ещё {achievements.filter((a) => !a.earned).length}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
