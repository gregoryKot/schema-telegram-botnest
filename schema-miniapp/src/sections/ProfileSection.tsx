import { useEffect, useState } from 'react';
import { getHost } from '../../../shared/src/host';
import { api, Achievement } from '../api';
import { useSafeTop } from '../utils/safezone';
import { AchievementDetail } from '../components/AchievementDetail';
import { TherapyNote } from '../components/TherapyNote';
import { ACHIEVEMENT_META } from './profile/constants';
import { StreakData, InsightsData } from './profile/types';
import { ProfileHeader } from './profile/ProfileHeader';
import { ProfileCards } from './profile/ProfileCards';
import { useAboutMe } from './profile/useAboutMe';
import { JourneySheet } from '../components/JourneySheet';
import { AchievementsSheet } from './profile/AchievementsSheet';
import { BestDayInfoSheet } from './profile/BestDayInfoSheet';
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

  const [streak, setStreak] = useState<StreakData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [ready, setReady] = useState(false);
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const aboutMe = useAboutMe(refreshKey);

  const [journeyOpen, setJourneyOpen] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<string | null>(
    null,
  );
  const [showBestDayInfo, setShowBestDayInfo] = useState(false);

  const blocks = useScreenBlocks('profile', SCREEN_HIDDEN_KEYS.profile);

  useEffect(() => {
    // Раньше streak/achievements/insights обнулялись перед рефетчем — провал
    // повторного запроса подменял реальный стрик показанным «0». Скелетон
    // и так управляется отдельным ready, обнулять данные не нужно.
    setReady(false);
    void Promise.all([
      api
        .getStreak()
        .then(setStreak)
        .catch((e) => console.error('getStreak failed', e)),
      api
        .getAchievements()
        .then(setAchievements)
        .catch((e) => console.error('getAchievements failed', e)),
      api
        .getInsights()
        .then(setInsights)
        .catch((e) => console.error('getInsights failed', e)),
      api
        .history(112)
        .then((h) => setActiveDates(new Set(h.map((d) => d.date))))
        .catch((e) => console.error('history failed', e)),
    ]).finally(() => setReady(true));
  }, [refreshKey]);

  const currentStreak = streak?.currentStreak ?? 0;
  const totalDays = streak?.totalDays ?? 0;
  const hasInsights =
    insights && insights.weeklyStats.some((s) => s.avg !== null);

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
          gap: 10,
        }}
      >
        {/* ── Скелетон ── */}
        {/* Первый блок (150) — силуэт карточки «Мой портрет», добавленной
            редизайном вкладки «Я» (правило «скелетоны по форме контента»).
            Списки «Мои схемы»/«Мои режимы»/«Тёплые слова» пропущены здесь
            намеренно: они прячутся при нулевых данных, и фиксированный
            силуэт для них соврал бы форме на пустом аккаунте. */}
        {!ready && (
          <>
            {[150, 88, 110, 80].map((h, i) => (
              <div
                key={i}
                style={{
                  height: h,
                  borderRadius: 20,
                  background:
                    'linear-gradient(90deg,rgba(var(--fg-rgb),0.03) 25%,rgba(var(--fg-rgb),0.07) 50%,rgba(var(--fg-rgb),0.03) 75%)',
                  backgroundSize: '200% auto',
                  animation: 'shimmer 1.5s linear infinite',
                }}
              />
            ))}
          </>
        )}

        {/* ── Карточки: скрываемые через «Настроить» / долгое нажатие ── */}
        <ProfileCards
          ready={ready}
          blocks={blocks}
          streak={streak}
          achievements={achievements}
          insights={insights}
          hasInsights={hasInsights}
          activeDates={activeDates}
          aboutMe={aboutMe}
          onOpenJourney={() => setJourneyOpen(true)}
          onOpenTracker={onOpenTracker}
          onShowAchievements={() => setShowAchievements(true)}
          onShowBestDayInfo={() => setShowBestDayInfo(true)}
          onOpenPatterns={onOpenPatterns}
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

      {/* ── Лист «Настроить экран» (шестерёнка / долгое нажатие на карточку) ── */}
      {blocks.sheet !== null && <ScreenCustomizeSheet blocks={blocks} />}
    </div>
  );
}
