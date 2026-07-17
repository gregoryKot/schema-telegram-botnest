import { useState } from 'react';
import { Achievement } from '../../api';
import { BottomSheet } from '../../components/BottomSheet';
import { botShortUrl } from '../../utils/botConfig';
import { ACHIEVEMENT_META } from './constants';

interface Props {
  achievements: Achievement[];
  currentStreak: number;
  totalDays: number;
}

export function AchievementsFeature({
  achievements,
  currentStreak,
  totalDays,
}: Props) {
  const [showAchievements, setShowAchievements] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<string | null>(
    null,
  );

  const earnedList = achievements.filter((a) => a.earned);

  return (
    <>
      {/* ── Достижения ── */}
      <div
        onClick={() => setShowAchievements(true)}
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

      {/* ── BottomSheet: Достижения ── */}
      {showAchievements && (
        <BottomSheet
          onClose={() => {
            setShowAchievements(false);
            setSelectedAchievement(null);
          }}
        >
          <div style={{ paddingTop: 4 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <span
                style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}
              >
                Достижения
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                {earnedList.length} из {achievements.length}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
              }}
            >
              {achievements.map((a) => {
                const m = ACHIEVEMENT_META[a.id];
                if (!m) return null;
                const progress = !a.earned
                  ? (() => {
                      switch (a.id) {
                        case 'streak_3':
                          return currentStreak > 0
                            ? `${currentStreak}/3`
                            : null;
                        case 'streak_7':
                          return currentStreak > 0
                            ? `${currentStreak}/7`
                            : null;
                        case 'streak_14':
                          return currentStreak > 0
                            ? `${currentStreak}/14`
                            : null;
                        case 'streak_30':
                          return currentStreak > 0
                            ? `${currentStreak}/30`
                            : null;
                        case 'streak_100':
                          return currentStreak > 0
                            ? `${currentStreak}/100`
                            : null;
                        case 'total_10':
                          return totalDays > 0 ? `${totalDays}/10` : null;
                        case 'total_50':
                          return totalDays > 0 ? `${totalDays}/50` : null;
                        default:
                          return null;
                      }
                    })()
                  : null;
                return (
                  <div
                    key={a.id}
                    onClick={() => a.earned && setSelectedAchievement(a.id)}
                    style={{
                      background: a.earned
                        ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                        : 'rgba(var(--fg-rgb),0.03)',
                      border: `1px solid ${a.earned ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : 'rgba(var(--fg-rgb),0.06)'}`,
                      borderRadius: 16,
                      padding: '14px 10px 12px',
                      textAlign: 'center',
                      cursor: a.earned ? 'pointer' : 'default',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 26,
                        marginBottom: 6,
                        filter: a.earned
                          ? 'none'
                          : 'grayscale(1) opacity(0.25)',
                      }}
                    >
                      {m.emoji}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: a.earned ? 'var(--text)' : 'var(--text-faint)',
                        marginBottom: 3,
                        lineHeight: 1.3,
                      }}
                    >
                      {m.title}
                    </div>
                    {progress ? (
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--accent)',
                          fontWeight: 600,
                        }}
                      >
                        {progress}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 10,
                          color: a.earned
                            ? 'var(--text-sub)'
                            : 'var(--text-faint)',
                          opacity: a.earned ? 1 : 0.5,
                          lineHeight: 1.4,
                        }}
                      >
                        {m.desc}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Achievement detail overlay */}
      {selectedAchievement &&
        (() => {
          const m = ACHIEVEMENT_META[selectedAchievement];
          if (!m) return null;
          return (
            <div
              onClick={() => setSelectedAchievement(null)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 400,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                animation: 'fade-in 0.18s ease',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--sheet-bg)',
                  borderRadius: 28,
                  padding: '36px 28px 28px',
                  width: '100%',
                  maxWidth: 320,
                  textAlign: 'center',
                  animation: 'sheet-up 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                }}
              >
                <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>
                  {m.emoji}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginBottom: 8,
                  }}
                >
                  {m.title}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--text-sub)',
                    lineHeight: 1.6,
                    marginBottom: 28,
                  }}
                >
                  {m.desc}
                </div>
                <button
                  onClick={async () => {
                    const text = `${m.emoji} Получил достижение «${m.title}»!\n\n${botShortUrl}`;
                    try {
                      if (navigator.share) await navigator.share({ text });
                      else await navigator.clipboard.writeText(text);
                    } catch {}
                  }}
                  className="btn-primary"
                >
                  Поделиться
                </button>
              </div>
            </div>
          );
        })()}
    </>
  );
}
