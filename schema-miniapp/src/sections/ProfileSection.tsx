import { useEffect, useState } from 'react';
import { api, Achievement } from '../api';
import { useSafeTop } from '../utils/safezone';
import { AchievementDetail } from '../components/AchievementDetail';
import { TherapyNote } from '../components/TherapyNote';
import { MyNotesSheet } from '../components/MyNotesSheet';
// prettier-ignore
import { ACHIEVEMENT_META, NEED_NAMES, StreakData, InsightsData } from './profile/constants';
import { StreakCard } from './profile/StreakCard';
import { ActivityHeatmap } from './profile/ActivityHeatmap';
import { AchievementsCard } from './profile/AchievementsCard';
import { InsightsCard } from './profile/InsightsCard';
import { NotesCard } from './profile/NotesCard';
import { AchievementsSheet } from './profile/AchievementsSheet';
import { BestDayInfoSheet } from './profile/BestDayInfoSheet';

export const DEFAULT_SECTION_KEY = 'default_section';

interface Props {
  onOpenSettings: () => void;
  onOpenTracker?: () => void;
  refreshKey?: number;
  displayName?: string | null;
}

export function ProfileSection({
  onOpenSettings,
  onOpenTracker,
  refreshKey,
  displayName,
}: Props) {
  const safeTop = useSafeTop();
  const tgName =
    window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name ?? '';
  const firstName = displayName || tgName;

  const [streak, setStreak] = useState<StreakData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [ready, setReady] = useState(false);
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());

  const [notesCount, setNotesCount] = useState<{
    schema: number;
    mode: number;
  } | null>(null);
  const [schemaNoteIds, setSchemaNotesIds] = useState<string[]>([]);
  const [modeNoteIds, setModeNoteIds] = useState<string[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<string | null>(
    null,
  );
  const [_insightsOpen] = useState(false); // kept for future use
  const [showBestDayInfo, setShowBestDayInfo] = useState(false);
  const [_homeScreenStatus] = useState<string | null>(null);

  useEffect(() => {
    setReady(false);
    setStreak(null);
    setAchievements(null);
    setInsights(null);
    void Promise.all([
      api
        .getStreak()
        .then(setStreak)
        .catch(() => {}),
      api
        .getAchievements()
        .then(setAchievements)
        .catch(() => {}),
      api
        .getInsights()
        .then(setInsights)
        .catch(() => {}),
      Promise.all([api.getSchemaNotes(), api.getModeNotes()])
        .then(([sn, mn]) => {
          setNotesCount({ schema: sn.length, mode: mn.length });
          setSchemaNotesIds(sn.map((n) => n.schemaId));
          setModeNoteIds(mn.map((n) => n.modeId));
        })
        .catch(() => {}),
      api
        .history(112)
        .then((h) => setActiveDates(new Set(h.map((d) => d.date))))
        .catch(() => {}),
    ]).finally(() => setReady(true));
  }, [refreshKey]);

  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;
  const totalDays = streak?.totalDays ?? 0;
  const todayDone = streak?.todayDone ?? false;
  const weekDots = streak?.weekDots ?? [];
  const earnedList = achievements?.filter((a) => a.earned) ?? [];
  const hasInsights =
    insights && insights.weeklyStats.some((s) => s.avg !== null);

  const _insightSummary = (() => {
    if (!insights) return null;
    if (insights.bestDayOfWeek && insights.totalDays >= 7)
      return `Лучший день — ${insights.bestDayOfWeek}`;
    const rising = insights.weeklyStats.find((s) => s.trend === '↑');
    if (rising) return `${NEED_NAMES[rising.needId]} растёт`;
    return 'Заполняй дневник каждый день';
  })();

  const _showHomeSuggestion = false; // moved to onboarding

  return (
    <div
      style={{
        minHeight: '100vh',
        paddingBottom: 140,
        paddingTop: safeTop,
        animation: 'fade-in 0.25s ease',
        overflowX: 'hidden',
      }}
    >
      {/* ── Хедер ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 20px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              flexShrink: 0,
              background:
                'linear-gradient(135deg, var(--accent), var(--accent-blue))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {(firstName || 'Я')[0].toUpperCase()}
          </div>
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: '-0.4px',
              }}
            >
              {firstName || 'Я'}
            </div>
            {totalDays > 0 && (
              <div
                style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 1 }}
              >
                {totalDays}{' '}
                {totalDays === 1 ? 'день' : totalDays < 5 ? 'дня' : 'дней'} в
                приложении
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: 'none',
            background: 'rgba(var(--fg-rgb),0.06)',
            color: 'var(--text-sub)',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ⚙️
        </button>
      </div>

      <div
        style={{
          padding: '16px 16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* ── Скелетон ── */}
        {!ready && (
          <>
            {[110, 80, 72].map((h, i) => (
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

        {/* ── Стрик ── */}
        {ready && streak !== null && (
          <StreakCard
            currentStreak={currentStreak}
            longestStreak={longestStreak}
            totalDays={totalDays}
            todayDone={todayDone}
            weekDots={weekDots}
            onOpenTracker={onOpenTracker}
          />
        )}

        {/* ── Activity heatmap ── */}
        {ready && activeDates.size > 0 && (
          <ActivityHeatmap activeDates={activeDates} />
        )}

        {/* ── Достижения ── */}
        {ready && achievements && (
          <AchievementsCard
            achievements={achievements}
            earnedList={earnedList}
            onOpen={() => setShowAchievements(true)}
          />
        )}

        {/* ── Паттерны (инсайты) ── */}
        {ready && hasInsights && insights && (
          <InsightsCard
            insights={insights}
            onOpenBestDayInfo={() => setShowBestDayInfo(true)}
          />
        )}

        {/* ── Мои записи ── */}
        {ready && notesCount !== null && (
          <NotesCard
            notesCount={notesCount}
            schemaNoteIds={schemaNoteIds}
            modeNoteIds={modeNoteIds}
            onOpen={() => setNotesOpen(true)}
          />
        )}

        <div style={{ padding: '4px 0' }}>
          <TherapyNote compact />
        </div>
      </div>

      {/* ── BottomSheet: Достижения ── */}
      {showAchievements && achievements && (
        <AchievementsSheet
          achievements={achievements}
          earnedList={earnedList}
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

      {notesOpen && <MyNotesSheet onClose={() => setNotesOpen(false)} />}
    </div>
  );
}
