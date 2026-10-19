import { useMemo, useState, lazy, Suspense } from 'react';
import type { Need } from '../types';
import type { UserTask, StreakData } from '../api';
import type { Section } from '../components/appShell/navigation';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { useTr } from '../utils/addressForm';
import { PhraseShareCard } from '../components/PhraseShareCard';
import '../styles/client-today.css';
const SchemaEx = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.SchemaEx })));
const ModeEx   = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));
import { TodayHeader } from './today/TodayHeader';
import { dayIndex, buildHistory, weekDelta, sparkBars } from './today/model';
import { AllTasksOverlay } from './today/AllTasksOverlay';
import { CaseEntryBlock } from './today/CaseEntryBlock';
import { useTaskActions } from './today/useTaskActions';
import { useTodayData } from './today/useTodayData';
import { useRatingSaver } from '../hooks/useRatingSaver';
import { NeedsCard } from './today/NeedsCard';
import { PracticesBlock } from './today/PracticesBlock';
import { DraftsBlock } from './today/DraftsBlock';
import { RecentEntries } from './today/RecentEntries';
import { IndexCard, MeetingCard } from './today/TodayAside';
import { StreakSlot, TherapistLink } from './today/TodayAsideExtras';
import { TodayFocusBlock } from './today/TodayFocusBlock';
import { TodayMoreToggle } from './today/TodayMoreToggle';
import { useTodayMore } from './today/todayMore';

export { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY };

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  yesterdayRatings?: Record<string, number>;
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes'; highlight?: string }) => void;
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
  /** Оценка потребности прямо со шкалы. Без неё клик по шкале открывает трекер. */
  rating?: TodayRating;
}

/** Обработчики оценки — те же, что AppShell отдаёт трекеру. */
export interface TodayRating {
  onChange: (needId: string, value: number) => void;
  onSaved: (needId: string, streak?: StreakData) => void;
  isOffline: boolean;
}

// ── TodaySection ──────────────────────────────────────────────────────────────

export function TodaySection({
  needs, ratings, yesterdayRatings = {},
  onOpenSchema, onOpenAdvanced, onOpenTracker, onOpenTrackerAt, onOpenTrackerHistory,
  onOpenDiaries, onOpenChildhoodWheel,
  refreshKey, userRole, onOpenTherapistCabinet, onTasksChanged, rating,
}: Props) {
  const tr = useTr();
  const more = useTodayMore();
  const data = useTodayData(refreshKey);
  const { profile, manualSchemaIds, recent, diariesLoaded, therapyRelation, historyDays } = data;
  const { tasks, taskHistory, taskError, completeTask, afterCreate } = useTaskActions(refreshKey);
  const [showDiaryTask,  setShowDiaryTask]  = useState(false);
  const [showAllTasks,   setShowAllTasks]   = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [introSchemaId,  setIntroSchemaId]  = useState<string | null>(null);
  const [introModeId,    setIntroModeId]    = useState<string | null>(null);
  const [activeTaskId,   setActiveTaskId]   = useState<number | null>(null);
  // «Сейчас» фиксируется при монтировании: Date.now() в теле рендера
  // недетерминирован (react-hooks/purity). Значение — дневного масштаба.
  const [now] = useState(() => Date.now());
  const save = useRatingSaver({ onSaved: rating?.onSaved, isOffline: rating?.isOffline, errorMessage: 'today rating save failed', section: 'today' });
  const rate = (needId: string, v: number) => { rating?.onChange(needId, v); save(needId, v); };

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const id = activeTaskId;
    setActiveTaskId(null);
    completeTask(id, onTasksChanged);
  }

  function handleTaskAction(task: UserTask) {
    if (task.type === 'schema_intro')   { setIntroSchemaId(task.text); setActiveTaskId(task.id); return; }
    if (task.type === 'mode_intro')     { setIntroModeId(task.text);   setActiveTaskId(task.id); return; }
    if (task.type === 'tracker_streak') { onOpenTracker(); return; }
    if (task.type === 'diary_streak')   { onOpenDiaries(); return; }
    if (task.type === 'childhood_wheel'){ onOpenChildhoodWheel(); return; }
    if (task.type === 'belief_check' || task.type === 'letter_to_self' || task.type === 'safe_place') { onOpenAdvanced(); return; }
  }

  const streak     = profile?.streak ?? 0;
  const firstName  = profile?.name?.split(' ')[0] ?? '';
  const hasSchemas = [...new Set([...(profile?.ysq?.activeSchemaIds ?? []), ...manualSchemaIds])].length > 0;
  const score      = dayIndex(needs.map(n => n.id), ratings);
  const history    = useMemo(() => buildHistory(historyDays, ratings), [historyDays, ratings]);
  const showTasks  = tasks.length > 0 || taskError;

  return (
    <div className="ds-page ct-page">

      <TodayHeader streak={streak} firstName={firstName} onOpenSettings={onOpenAdvanced} />

      <div className={'ct-grid' + (more.open ? ' is-more-open' : '')}>

        <div className="ct-main">
          <TodayFocusBlock needs={needs} ratings={ratings} data={data} onOpenTracker={onOpenTracker} onOpenTrackerHistory={onOpenTrackerHistory} />

          {userRole === 'THERAPIST' && onOpenTherapistCabinet && <TherapistLink onOpen={onOpenTherapistCabinet} />}

          {/* Точка входа «Что это было» + онбординг после первого разбора */}
          <CaseEntryBlock
            profile={profile}
            hasSchemas={hasSchemas}
            onOpenSchema={onOpenSchema}
            onOpenAdvanced={onOpenAdvanced}
            onOpenTracker={onOpenTracker}
            onOpenDiaries={onOpenDiaries}
            onOpenChildhoodWheel={onOpenChildhoodWheel}
          />

          <NeedsCard
            needs={needs}
            ratings={ratings}
            yesterdayRatings={yesterdayRatings}
            onRate={rating ? rate : undefined}
            onOpenNeed={id => (onOpenTrackerAt ? onOpenTrackerAt(id) : onOpenTracker())}
            onOpenTracker={onOpenTracker}
          />

          {showTasks && (
            <PracticesBlock
              tasks={tasks}
              taskError={taskError}
              onStart={handleTaskAction}
              onShowAll={() => setShowAllTasks(true)}
              onAddGoal={() => setShowDiaryTask(true)}
            />
          )}

          <DraftsBlock onOpenDiaries={onOpenDiaries} />
          <RecentEntries entries={recent} loaded={diariesLoaded} onOpenDiaries={onOpenDiaries} />
        </div>

        <aside className="ct-aside" aria-label={tr('Твой день', 'Ваш день')}>
          <div className="ct-top">
            <IndexCard score={score} weekDelta={weekDelta(history)} bars={sparkBars(history)} onOpenHistory={onOpenTrackerHistory} />
            <MeetingCard relation={therapyRelation} now={now} />
          </div>
          <StreakSlot streak={streak} />
          <PhraseShareCard />
        </aside>

        <TodayMoreToggle open={more.open} onToggle={more.toggle} />
      </div>

      {/* Overlays */}
      {showDiaryTask && <TaskCreateSheet defaultType="diary_streak" onCreated={() => setShowDiaryTask(false)} onClose={() => setShowDiaryTask(false)} />}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => { setShowTaskCreate(false); afterCreate(onTasksChanged); }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      {introSchemaId && (
        <div className="u-sheet">
          <Suspense fallback={null}><SchemaEx onBack={() => setIntroSchemaId(null)} initialSchemaId={introSchemaId} onComplete={() => { setIntroSchemaId(null); handleTaskComplete(); }} /></Suspense>
        </div>
      )}
      {introModeId && (
        <div className="u-sheet">
          <Suspense fallback={null}><ModeEx onBack={() => setIntroModeId(null)} initialModeId={introModeId} onComplete={() => { setIntroModeId(null); handleTaskComplete(); }} /></Suspense>
        </div>
      )}

      {/* All tasks overlay */}
      {showAllTasks && (
        <AllTasksOverlay
          tasks={tasks}
          taskHistory={taskHistory}
          onClose={() => setShowAllTasks(false)}
          onTaskDone={id => completeTask(id)}
          onAddTask={() => { setShowAllTasks(false); setShowTaskCreate(true); }}
        />
      )}
    </div>
  );
}
