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
import { Need, UserProfile } from '../types';
import { api, UserTask } from '../api';
import { Section } from '../components/BottomNav';
import { useSafeTop } from '../utils/safezone';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapyData';
import { fmtDate, todayStr } from '../utils/format';
import { readLocalIds } from './today/helpers';
import { TodayHeader } from './today/TodayHeader';
import { TherapistBanner } from './today/TherapistBanner';
import { OnboardingWidget } from './today/OnboardingWidget';
import { NeedsCard } from './today/NeedsCard';
import { DiaryCard, DiaryPreviewEntry } from './today/DiaryCard';
import { AllTasksSheet } from './today/AllTasksSheet';

export { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY };

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  yesterdayRatings?: Record<string, number>;
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: {
    startTest?: boolean;
    tab?: 'needs' | 'schemas' | 'modes';
    highlight?: string;
  }) => void;
  onOpenAdvanced: () => void;
  onOpenTracker: () => void;
  onOpenTrackerAt?: (needId: string) => void;
  onOpenTrackerHistory?: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
  refreshKey?: number;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
  onTasksChanged?: () => void;
}

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
}: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() =>
    readLocalIds(MY_SCHEMA_IDS_KEY),
  );
  const [recentDiaries, setRecentDiaries] = useState<DiaryPreviewEntry[]>([]);
  const [diariesLoaded, setDiariesLoaded] = useState(false);
  const [showDiaryTask, setShowDiaryTask] = useState(false);
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [taskHistory, setTaskHistory] = useState<UserTask[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [introSchemaId, setIntroSchemaId] = useState<string | null>(null);
  const [introModeId, setIntroModeId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const safeTop = useSafeTop();

  const firstName =
    (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.first_name ?? '';

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

  function openTask(task: UserTask) {
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
      default:
        if (ALL_SCHEMAS.some((s) => s.id === task.text)) {
          setIntroSchemaId(task.text);
          break;
        }
        if (ALL_MODES.some((m) => m.id === task.text)) {
          setIntroModeId(task.text);
          break;
        }
        // belief_check, letter_to_self etc — navigate to Help
        onNavigate('help');
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

  const myTasks = tasks.filter((t) => t.assignedBy === null);
  const therapistTasks = tasks.filter((t) => t.assignedBy !== null);
  const hasAnyTask = tasks.length > 0;

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
      style={{ minHeight: '100vh', paddingBottom: 120, paddingTop: safeTop }}
    >
      {/* ── Header ── */}
      <TodayHeader firstName={firstName} profile={profile} streak={streak} />

      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* ── Therapist cabinet banner ── */}
        {userRole === 'THERAPIST' && onOpenTherapistCabinet && (
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

        {/* ── Needs card — tap card = history, tap need = tracker ── */}
        <NeedsCard
          needs={needs}
          ratings={ratings}
          yesterdayRatings={yesterdayRatings}
          onOpenTracker={onOpenTracker}
          onOpenTrackerAt={onOpenTrackerAt}
          onOpenTrackerHistory={onOpenTrackerHistory}
          ratedCount={ratedCount}
          allRated={allRated}
          avgScore={avgScore}
        />

        {/* ── Diary card ── */}
        <DiaryCard
          onOpenDiaries={onOpenDiaries}
          diariesLoaded={diariesLoaded}
          recentDiaries={recentDiaries}
          onSetDiaryTask={() => setShowDiaryTask(true)}
        />
      </div>

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

      {/* All tasks sheet */}
      {showAllTasks && (
        <AllTasksSheet
          tasks={tasks}
          taskHistory={taskHistory}
          onClose={() => setShowAllTasks(false)}
          setTasks={setTasks}
          setTaskHistory={setTaskHistory}
          onOpenCreate={() => {
            setShowAllTasks(false);
            setShowTaskCreate(true);
          }}
        />
      )}
    </div>
  );
}
