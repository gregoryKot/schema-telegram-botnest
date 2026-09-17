import { useState } from 'react';
import { getHost } from '../../../shared/src/host';
import { useSafeTop } from '../utils/safezone';
import { AchievementDetail } from '../components/AchievementDetail';
import { TherapyNote } from '../components/TherapyNote';
import { ACHIEVEMENT_META } from './profile/constants';
import { ProfileHeader } from './profile/ProfileHeader';
import { ProfileCards } from './profile/ProfileCards';
import { useAboutMe } from './profile/useAboutMe';
import { useProfileStats } from './profile/useProfileStats';
import { JourneySheet } from '../components/JourneySheet';
import { AchievementsSheet } from './profile/AchievementsSheet';
import { BestDayInfoSheet } from './profile/BestDayInfoSheet';
import { PortraitSheet } from './profile/PortraitSheet';
import { useScreenBlocks } from '../hooks/useScreenBlocks';
import { SCREEN_HIDDEN_KEYS } from '../utils/screenBlocks';
import { ScreenCustomizeSheet } from '../components/customize/ScreenCustomizeSheet';

export const DEFAULT_SECTION_KEY = 'default_section';

interface Props {
  onOpenSettings: () => void;
  onOpenTracker?: () => void;
  refreshKey?: number;
  displayName?: string | null;
  onOpenPatterns: (tab: 'schemas' | 'modes') => void;
}

export function ProfileSection({
  onOpenSettings,
  onOpenTracker,
  refreshKey,
  displayName,
  onOpenPatterns,
}: Props) {
  const safeTop = useSafeTop();
  const tgName = getHost().user()?.firstName ?? '';
  const firstName = displayName || tgName;

  // Прогрессивный рендер (замер 2026-08-22, профиль 3G+CPU×4): раньше
  // streak/achievements/insights/history(112) грузились одним Promise.all
  // с единым `ready`, и самый долгий ответ держал пустым весь экран
  // (1321мс). useProfileStats даёт каждому источнику свой ready; тяжёлая
  // history(112) для тепловой карты вынесена совсем отдельно и лениво —
  // см. HeatmapCard внутри ProfileCards.
  const {
    streak,
    streakReady,
    achievements,
    achievementsReady,
    insights,
    insightsReady,
    hasInsights,
  } = useProfileStats(refreshKey);
  const aboutMe = useAboutMe(refreshKey);

  const [journeyOpen, setJourneyOpen] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<string | null>(
    null,
  );
  const [showBestDayInfo, setShowBestDayInfo] = useState(false);
  const [showPortrait, setShowPortrait] = useState(false);

  const blocks = useScreenBlocks('profile', SCREEN_HIDDEN_KEYS.profile);

  const currentStreak = streak?.currentStreak ?? 0;
  const totalDays = streak?.totalDays ?? 0;

  return (
    <div
      className="section-pad"
      style={{
        paddingTop: safeTop,
        animation: 'fade-in 0.25s ease',
        overflowX: 'hidden',
      }}
    >
      {/* ── Хедер ── */}
      <ProfileHeader
        firstName={firstName}
        totalDays={totalDays}
        onOpenSettings={onOpenSettings}
        onCustomize={blocks.openByGear}
      />

      <div
        style={{
          padding: '16px 16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-10)',
        }}
      >
        {/* ── Карточки: скрываемые через «Настроить» / долгое нажатие ──
            Общего скелетона на весь блок больше нет — каждая карточка
            показывает свой силуэт, пока летят именно её данные
            (ProfileCardSkeletons.tsx). */}
        <ProfileCards
          blocks={blocks}
          streak={streak}
          streakReady={streakReady}
          achievements={achievements}
          achievementsReady={achievementsReady}
          insights={insights}
          insightsReady={insightsReady}
          hasInsights={hasInsights}
          aboutMe={aboutMe}
          onOpenJourney={() => setJourneyOpen(true)}
          onOpenTracker={onOpenTracker}
          onShowAchievements={() => setShowAchievements(true)}
          onShowBestDayInfo={() => setShowBestDayInfo(true)}
          onOpenPatterns={onOpenPatterns}
          onOpenPortrait={() => setShowPortrait(true)}
        />

        <div style={{ padding: '4px 0' }}>
          <TherapyNote compact />
        </div>
      </div>

      {/* ── BottomSheet: Достижения ── */}
      {showAchievements && achievements && (
        <AchievementsSheet
          achievements={achievements}
          currentStreak={currentStreak}
          totalDays={totalDays}
          onClose={() => {
            setShowAchievements(false);
            setSelectedAchievement(null);
          }}
          onSelect={(id) => setSelectedAchievement(id)}
        />
      )}

      {/* Achievement detail overlay (share-карточка внутри) */}
      {selectedAchievement && ACHIEVEMENT_META[selectedAchievement] && (
        <AchievementDetail
          meta={ACHIEVEMENT_META[selectedAchievement]}
          onClose={() => setSelectedAchievement(null)}
        />
      )}

      {/* Best day tooltip */}
      {showBestDayInfo && (
        <BestDayInfoSheet onClose={() => setShowBestDayInfo(false)} />
      )}

      {journeyOpen && <JourneySheet onClose={() => setJourneyOpen(false)} />}

      {/* ── BottomSheet: Мой портрет (полные списки схем/режимов) ── */}
      {showPortrait && (
        <PortraitSheet
          aboutMe={aboutMe}
          onOpenPatterns={onOpenPatterns}
          onClose={() => setShowPortrait(false)}
        />
      )}

      {/* ── Лист «Настроить экран» (шестерёнка / долгое нажатие на карточку) ── */}
      {blocks.sheet !== null && <ScreenCustomizeSheet blocks={blocks} />}
    </div>
  );
}
