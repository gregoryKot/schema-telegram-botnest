// TodaySection.tsx — Redesigned Today screen
// Place at: src/sections/TodaySection.tsx
// Replaces the existing TodaySection.
//
// Key differences from original:
//  – NeedMini grid with fill-bar indicators (tap opens tracker at that need)
//  – Average score card when all needs rated
//  – Diary preview with left-rail type indicator
//  – Onboarding step card with dot progress
//  – All colors via CSS tokens (light/dark theme ready)

import { useEffect, useState } from 'react';
import { getHost } from '../../../shared/src/host';
import { UserProfile } from '../types';
import { api } from '../api';
import { useSafeTop } from '../utils/safezone';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { fmtDate, todayStr } from '../utils/format';
import { TodayFocusCard } from '../components/TodayFocusCard';
import { PhraseShareCard } from '../components/PhraseShareCard';
import { HomeScreenOfferCard } from '../components/HomeScreenOfferCard';
import { GearButton } from '../components/GearButton';
import { TodayCustomizeSheet } from '../components/TodayCustomizeSheet';
import { useTodayCustomization } from '../hooks/useTodayCustomization';
import { useTr } from '../utils/addressForm';
import { DayShareButton } from '../share/DayShareButton';
import { Props } from './today/types';
import {
  TODAY_MORE_KEY,
  formatGreetingDate,
  readLocalIds,
} from './today/helpers';
import { OnboardingWidget } from './today/OnboardingWidget';
import { SecondaryCards } from './today/SecondaryCards';
import { StreakCard } from './today/StreakCard';
import { TherapistBanner } from './today/TherapistBanner';

export { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY };

// ── TodaySection ──────────────────────────────────────────────────────────────

export function TodaySection({
  needs,
  ratings,
  yesterdayRatings = {},
  onOpenSchema,
  onOpenAdvanced,
  onOpenTracker,
  onOpenTrackerAt,
  onOpenTrackerHistory,
  onOpenDiaries,
  onOpenChildhoodWheel,
  refreshKey,
  userRole,
  onOpenTherapistCabinet,
  onNewDiaryEntry,
}: Props) {
  const tr = useTr();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() =>
    readLocalIds(MY_SCHEMA_IDS_KEY),
  );
  const [recentDiaries, setRecentDiaries] = useState<
    Array<{ type: string; label: string; time: string; dateStr: string }>
  >([]);
  const [diariesLoaded, setDiariesLoaded] = useState(false);
  const [showDiaryTask, setShowDiaryTask] = useState(false);
  const today = useTodayCustomization();
  const [todayDone, setTodayDone] = useState({
    schema: false,
    mode: false,
    gratitude: false,
  });
  const [moreOpen, setMoreOpen] = useState(
    () => localStorage.getItem(TODAY_MORE_KEY) === '1',
  );
  const safeTop = useSafeTop();

  function toggleMore() {
    setMoreOpen((prev) => {
      const next = !prev;
      if (next) localStorage.setItem(TODAY_MORE_KEY, '1');
      else localStorage.removeItem(TODAY_MORE_KEY);
      return next;
    });
  }

  const firstName = getHost().user()?.firstName ?? '';

  useEffect(() => {
    let ignore = false;
    setProfile(null);
    setDiariesLoaded(false);

    api
      .getProfile()
      .then((p) => {
        if (ignore) return;
        setProfile(p);
        if (p.mySchemaIds.length > 0) {
          setManualSchemaIds(p.mySchemaIds);
          localStorage.setItem(
            MY_SCHEMA_IDS_KEY,
            JSON.stringify(p.mySchemaIds),
          );
        }
      })
      .catch((e) => console.error('getProfile failed', e));

    Promise.all([
      api.getSchemaDiary(),
      api.getModeDiary(),
      api.getGratitudeDiary(),
    ])
      .then(([schema, mode, gratitude]) => {
        if (ignore) return;
        const today = todayStr();
        const dateLabel = (iso: string) =>
          iso.slice(0, 10) === today ? 'Сегодня' : fmtDate(iso.slice(0, 10));
        const all = [
          ...schema.slice(0, 2).map((e) => ({
            type: 'schema',
            label: e.trigger.slice(0, 46),
            time: e.createdAt.slice(11, 16),
            dateStr: dateLabel(e.createdAt),
            sortKey: e.createdAt,
          })),
          ...mode.slice(0, 2).map((e) => ({
            type: 'mode',
            label: e.situation.slice(0, 46),
            time: e.createdAt.slice(11, 16),
            dateStr: dateLabel(e.createdAt),
            sortKey: e.createdAt,
          })),
          ...gratitude.slice(0, 2).map((e) => ({
            type: 'gratitude',
            label: e.items[0]?.slice(0, 46) ?? 'Благодарность',
            time: '',
            dateStr: e.date === today ? 'Сегодня' : fmtDate(e.date),
            sortKey: e.date,
          })),
        ];
        all.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        setRecentDiaries(all.slice(0, 3));
        setTodayDone({
          schema: schema.some((e) => e.createdAt.slice(0, 10) === today),
          mode: mode.some((e) => e.createdAt.slice(0, 10) === today),
          gratitude: gratitude.some((e) => e.date === today),
        });
      })
      .catch((e) => console.error('diaries load failed', e))
      .finally(() => {
        if (!ignore) setDiariesLoaded(true);
      });

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const streak = profile?.streak ?? 0;
  const ratedCount = needs.filter((n) => ratings[n.id] !== undefined).length;
  const allRated = needs.length > 0 && ratedCount === needs.length;
  const avgScore = allRated
    ? (needs.reduce((s, n) => s + ratings[n.id], 0) / needs.length).toFixed(1)
    : null;
  const hasSchemas =
    [...new Set([...(profile?.ysq.activeSchemaIds ?? []), ...manualSchemaIds])]
      .length > 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        paddingBottom: 'calc(120px + var(--safe-bottom))',
        paddingTop: safeTop,
        animation: 'fade-in 0.25s ease',
      }}
    >
      {/* ── Header (по дизайн-макету: приветствие + темп без давления) ── */}
      <div style={{ padding: '24px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            className="d-display"
            style={{
              fontSize: 26,
              lineHeight: 1.15,
            }}
          >
            {firstName ? `Привет, ${firstName}` : 'Добро пожаловать'}
          </div>
          <div style={{ marginTop: -6, flexShrink: 0 }}>
            <GearButton
              onClick={today.openByGear}
              ariaLabel="Настроить экран"
            />
          </div>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginTop: 4,
            fontWeight: 500,
          }}
        >
          {formatGreetingDate()} · {tr('твой темп', 'ваш темп')}
        </div>
      </div>

      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* ── Therapist cabinet banner ── */}
        {userRole === 'THERAPIST' &&
          onOpenTherapistCabinet &&
          !today.therapistBannerHidden && (
            <TherapistBanner onOpen={onOpenTherapistCabinet} />
          )}

        {/* ── Onboarding widget ── */}
        <OnboardingWidget
          profile={profile}
          hasSchemas={hasSchemas}
          onOpenSchema={onOpenSchema}
          onOpenAdvanced={onOpenAdvanced}
          onOpenTracker={onOpenTracker}
          onOpenDiaries={onOpenDiaries}
          onOpenChildhoodWheel={onOpenChildhoodWheel}
        />

        {/* ── Стрик-карточка (макет): мягкая, без наказания за пропуск ── */}
        {!today.streakHidden && streak > 0 && (
          <div {...today.holdStreak}>
            <StreakCard streak={streak} />
          </div>
        )}

        {/* ── Фокус дня: одна главная задача (нейроинклюзивность, волна 1) ── */}
        <div {...today.holdFocus}>
          <TodayFocusCard
            practice={today.practice}
            ratedCount={ratedCount}
            total={needs.length}
            avgScore={avgScore}
            practiceDoneToday={
              today.practice !== 'tracker' && todayDone[today.practice]
            }
            onAction={() =>
              today.practice === 'tracker'
                ? onOpenTracker()
                : onNewDiaryEntry?.(today.practice)
            }
            onOpenHistory={onOpenTrackerHistory}
            shareSlot={<DayShareButton needs={needs} ratings={ratings} />}
          />
        </div>

        {/* ── Фраза Здорового взрослого (перенесена с «Помощи») ── */}
        {!today.phraseHidden && (
          <div {...today.holdPhrase}>
            <PhraseShareCard />
          </div>
        )}

        {/* ── Значок на экран: тем, кто продолжает заходить ── */}
        <HomeScreenOfferCard />

        {/* ── Прогрессивное раскрытие: остальное — по желанию ── */}
        {today.secondaryHidden && (
          <button
            onClick={toggleMore}
            aria-expanded={moreOpen}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'var(--text-sub)',
              fontSize: 13,
              fontWeight: 600,
              padding: '6px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {moreOpen ? 'Свернуть' : 'Что ещё можно сегодня'}
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: moreOpen ? 'rotate(180deg)' : 'none',
              }}
            >
              ⌄
            </span>
          </button>
        )}

        {(!today.secondaryHidden || moreOpen) && (
          <SecondaryCards
            needs={needs}
            ratings={ratings}
            yesterdayRatings={yesterdayRatings}
            ratedCount={ratedCount}
            allRated={allRated}
            diariesLoaded={diariesLoaded}
            recentDiaries={recentDiaries}
            onOpenTrackerHistory={onOpenTrackerHistory}
            onOpenTrackerAt={onOpenTrackerAt}
            onOpenTracker={onOpenTracker}
            onOpenDiaries={onOpenDiaries}
            onSetDiaryTask={() => setShowDiaryTask(true)}
          />
        )}
      </div>

      {today.sheet && (
        <TodayCustomizeSheet
          practice={today.practice}
          highlight={today.highlight}
          streakHidden={today.streakHidden}
          phraseHidden={today.phraseHidden}
          secondaryHidden={today.secondaryHidden}
          therapistBannerHidden={today.therapistBannerHidden}
          showTherapistToggle={
            userRole === 'THERAPIST' && !!onOpenTherapistCabinet
          }
          onPractice={today.choosePractice}
          onToggleStreak={today.toggleStreak}
          onTogglePhrase={today.togglePhrase}
          onToggleSecondary={today.toggleSecondary}
          onToggleTherapistBanner={today.toggleTherapistBanner}
          onOpenSettings={() => {
            today.closeSheet();
            onOpenAdvanced();
          }}
          onClose={today.closeSheet}
        />
      )}
      {showDiaryTask && (
        <TaskCreateSheet
          defaultType="diary_streak"
          onCreated={() => setShowDiaryTask(false)}
          onClose={() => setShowDiaryTask(false)}
        />
      )}
    </div>
  );
}
