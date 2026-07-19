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
import { UserProfile } from '../types';
import { api, UserTask } from '../api';
import { useSafeTop } from '../utils/safezone';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { BottomSheet } from '../components/BottomSheet';
import { fmtDate, todayStr } from '../utils/format';
import { TaskRow } from '../components/tasks/TaskRow';
import { TaskHistoryList } from '../components/tasks/TaskHistoryList';
import { findLegacyTaskTarget } from '../components/tasks/taskEmoji';
import { TodayFocusCard } from '../components/TodayFocusCard';
import { TodayCustomizeSheet } from '../components/TodayCustomizeSheet';
import {
  FocusPractice,
  getFocusPractice,
  setFocusPractice,
  isStreakHidden,
  setStreakHidden,
  isSecondaryHidden,
  setSecondaryHidden,
  isTherapistBannerHidden,
  setTherapistBannerHidden,
} from '../utils/todayFocus';
import { useTr } from '../utils/addressForm';
import { ShareCardSheet } from '../share/ShareCardSheet';
import {
  drawDayCard,
  buildDayShareText,
} from '../../../shared/src/share/cards/dayCard';
import { botShortUrl } from '../utils/botConfig';
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
  onNavigate,
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
  onTasksChanged,
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
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [taskHistory, setTaskHistory] = useState<UserTask[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [introSchemaId, setIntroSchemaId] = useState<string | null>(null);
  const [introModeId, setIntroModeId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [showDayShare, setShowDayShare] = useState(false);
  const [focusPractice, setFocusPracticeState] =
    useState<FocusPractice>(getFocusPractice);
  const [streakHidden, setStreakHiddenState] = useState(isStreakHidden);
  const [showCustomize, setShowCustomize] = useState(false);
  const [secondaryHidden, setSecondaryHiddenState] =
    useState(isSecondaryHidden);
  const [therapistBannerHidden, setTherapistBannerHiddenState] = useState(
    isTherapistBannerHidden,
  );
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

  const firstName =
    window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name ?? '';

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
      .catch(() => {});

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
      .catch(() => {})
      .finally(() => {
        if (!ignore) setDiariesLoaded(true);
      });

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    Promise.all([api.getTasks(), api.getTaskHistory()])
      .then(([t, h]) => {
        setTasks(t);
        setTaskHistory(h);
      })
      .catch(() => {});
  }, [refreshKey]);

  function _openTask(task: UserTask) {
    if (task.assignedBy !== null && task.type !== 'custom')
      setActiveTaskId(task.id);
    switch (task.type) {
      case 'diary_streak':
        onOpenDiaries();
        break;
      case 'tracker_streak':
        onOpenTracker();
        break;
      case 'schema_intro':
        if (task.text) setIntroSchemaId(task.text);
        break;
      case 'mode_intro':
        if (task.text) setIntroModeId(task.text);
        break;
      default: {
        const legacy = findLegacyTaskTarget(task.text);
        if (legacy?.type === 'schema') {
          setIntroSchemaId(legacy.id);
          break;
        }
        if (legacy?.type === 'mode') {
          setIntroModeId(legacy.id);
          break;
        }
        // belief_check, letter_to_self etc — navigate to Help
        onNavigate('help');
      }
    }
  }

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const id = activeTaskId;
    setActiveTaskId(null);
    api
      .completeTask(id, true)
      .then(() => Promise.all([api.getTasks(), api.getTaskHistory()]))
      .then(([t, h]) => {
        setTasks(t);
        setTaskHistory(h);
        onTasksChanged?.();
      })
      .catch(() => {});
  }

  const _myTasks = tasks.filter((t) => t.assignedBy === null);
  const _therapistTasks = tasks.filter((t) => t.assignedBy !== null);
  const _hasAnyTask = tasks.length > 0;

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
        paddingBottom: 120,
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
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}
          >
            {firstName ? `Привет, ${firstName} 👋` : 'Добро пожаловать 👋'}
          </div>
          <button
            onClick={() => setShowCustomize(true)}
            aria-label="Настроить экран"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: '1px solid var(--border-color)',
              background: 'var(--surface)',
              color: 'var(--text-sub)',
              fontSize: 17,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: -6,
            }}
          >
            ⚙
          </button>
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
          !therapistBannerHidden && (
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
        {!streakHidden && streak > 0 && <StreakCard streak={streak} />}

        {/* ── Фокус дня: одна главная задача (нейроинклюзивность, волна 1) ── */}
        <TodayFocusCard
          practice={focusPractice}
          ratedCount={ratedCount}
          total={needs.length}
          avgScore={avgScore}
          practiceDoneToday={
            focusPractice !== 'tracker' && todayDone[focusPractice]
          }
          onAction={() =>
            focusPractice === 'tracker'
              ? onOpenTracker()
              : onNewDiaryEntry?.(focusPractice)
          }
          onOpenHistory={onOpenTrackerHistory}
          onShareDay={() => setShowDayShare(true)}
        />

        {/* ── Прогрессивное раскрытие: остальное — по желанию ── */}
        {secondaryHidden && (
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

        {(!secondaryHidden || moreOpen) && (
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

      {showCustomize && (
        <TodayCustomizeSheet
          practice={focusPractice}
          streakHidden={streakHidden}
          secondaryHidden={secondaryHidden}
          therapistBannerHidden={therapistBannerHidden}
          showTherapistToggle={
            userRole === 'THERAPIST' && !!onOpenTherapistCabinet
          }
          onPractice={(p) => {
            setFocusPractice(p);
            setFocusPracticeState(p);
            api.trackEvent('today_focus_change', { practice: p });
          }}
          onToggleStreak={() => {
            const next = !streakHidden;
            setStreakHidden(next);
            setStreakHiddenState(next);
            api.trackEvent('today_streak_toggle', { hidden: next });
          }}
          onToggleSecondary={() => {
            const next = !secondaryHidden;
            setSecondaryHidden(next);
            setSecondaryHiddenState(next);
          }}
          onToggleTherapistBanner={() => {
            const next = !therapistBannerHidden;
            setTherapistBannerHidden(next);
            setTherapistBannerHiddenState(next);
          }}
          onOpenSettings={() => {
            setShowCustomize(false);
            onOpenAdvanced();
          }}
          onClose={() => setShowCustomize(false)}
        />
      )}
      {showDiaryTask && (
        <TaskCreateSheet
          defaultType="diary_streak"
          onCreated={() => setShowDiaryTask(false)}
          onClose={() => setShowDiaryTask(false)}
        />
      )}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => {
            setShowTaskCreate(false);
            Promise.all([api.getTasks(), api.getTaskHistory()])
              .then(([t, h]) => {
                setTasks(t);
                setTaskHistory(h);
                onTasksChanged?.();
              })
              .catch(() => {});
          }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      {introSchemaId && (
        <SchemaIntroSheet
          schemaId={introSchemaId}
          onClose={() => setIntroSchemaId(null)}
          onComplete={() => {
            setIntroSchemaId(null);
            handleTaskComplete();
          }}
        />
      )}
      {introModeId && (
        <ModeIntroSheet
          modeId={introModeId}
          onClose={() => setIntroModeId(null)}
          onComplete={() => {
            setIntroModeId(null);
            handleTaskComplete();
          }}
        />
      )}

      {showDayShare && (
        <ShareCardSheet
          title="Карточка дня"
          draw={(canvas) =>
            drawDayCard(canvas, needs, ratings, fmtDate(todayStr()))
          }
          shareText={buildDayShareText(
            needs,
            ratings,
            fmtDate(todayStr()),
            botShortUrl,
          )}
          filename="needs-day.png"
          eventKind="day"
          onClose={() => setShowDayShare(false)}
          therapyNote
        />
      )}

      {/* All tasks sheet */}
      {showAllTasks && (
        <BottomSheet onClose={() => setShowAllTasks(false)} zIndex={200}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 20,
            }}
          >
            Все задания
          </div>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              variant="compact"
              onComplete={() =>
                api
                  .completeTask(task.id, true)
                  .then(() =>
                    Promise.all([api.getTasks(), api.getTaskHistory()]).then(
                      ([t, h]) => {
                        setTasks(t);
                        setTaskHistory(h);
                      },
                    ),
                  )
                  .catch(() => {})
              }
            />
          ))}
          <TaskHistoryList taskHistory={taskHistory} variant="compact" />
          <button
            onClick={() => {
              setShowAllTasks(false);
              setShowTaskCreate(true);
            }}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '13px 0',
              borderRadius: 14,
              border: 'none',
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Поставить цель
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
