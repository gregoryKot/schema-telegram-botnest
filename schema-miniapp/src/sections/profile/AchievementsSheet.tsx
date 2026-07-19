import { useCallback, useState } from 'react';
import { Achievement } from '../../api';
import { BottomSheet } from '../../components/BottomSheet';
import { pressable } from '../../utils/a11y';
import { ACHIEVEMENT_META } from './constants';
import { SharePill } from '../../share/SharePill';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { drawAchievementsCard } from '../../../../shared/src/share/cards/achievementsCard';
import { achievementsShareText } from '../../../../shared/src/share/shareTexts';
import { botShortUrl } from '../../utils/botConfig';

interface AchievementsSheetProps {
  achievements: Achievement[];
  currentStreak: number;
  totalDays: number;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function AchievementsSheet({
  achievements,
  currentStreak,
  totalDays,
  onClose,
  onSelect,
}: AchievementsSheetProps) {
  const earnedList = achievements.filter((a) => a.earned);
  const [showShare, setShowShare] = useState(false);

  const drawAll = useCallback(
    (canvas: HTMLCanvasElement) => {
      drawAchievementsCard(
        canvas,
        achievements
          .filter((a) => ACHIEVEMENT_META[a.id])
          .map((a) => ({
            emoji: ACHIEVEMENT_META[a.id].emoji,
            earned: a.earned,
          })),
      );
    },
    [achievements],
  );

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            Достижения
          </span>
          <span
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              marginRight: 'auto',
            }}
          >
            {earnedList.length} из {achievements.length}
          </span>
          {earnedList.length > 0 && (
            <SharePill compact onClick={() => setShowShare(true)} />
          )}
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
                      return currentStreak > 0 ? `${currentStreak}/3` : null;
                    case 'streak_7':
                      return currentStreak > 0 ? `${currentStreak}/7` : null;
                    case 'streak_14':
                      return currentStreak > 0 ? `${currentStreak}/14` : null;
                    case 'streak_30':
                      return currentStreak > 0 ? `${currentStreak}/30` : null;
                    case 'streak_100':
                      return currentStreak > 0 ? `${currentStreak}/100` : null;
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
                {...pressable(() => a.earned && onSelect(a.id))}
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
                    filter: a.earned ? 'none' : 'grayscale(1) opacity(0.25)',
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
                      color: a.earned ? 'var(--text-sub)' : 'var(--text-faint)',
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

      {showShare && (
        <ShareCardSheet
          title="Мои достижения"
          draw={drawAll}
          shareText={achievementsShareText(
            earnedList.length,
            achievements.length,
            botShortUrl,
          )}
          filename="achievements.png"
          eventKind="achievements"
          onClose={() => setShowShare(false)}
          zIndex={300}
        />
      )}
    </BottomSheet>
  );
}
