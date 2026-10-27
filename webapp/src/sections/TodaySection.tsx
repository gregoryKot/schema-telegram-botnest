import { useState, lazy, Suspense } from 'react';
import type { Need } from '../types';
import type { UserTask } from '../api';
import type { Section } from '../components/appShell/navigation';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { HomeScreenOfferCard } from '../components/HomeScreenOfferCard';
import { CaseFlowHost } from '../components/caseFlow/CaseFlowHost';
import { WhySheet } from '../components/WhySheet';
import '../styles/client-today.css';
const SchemaEx = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.SchemaEx })));
const ModeEx   = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));
import { AllTasksOverlay } from './today/AllTasksOverlay';
import { PracticesBlock } from './today/PracticesBlock';
import { HomeTiles } from './today/HomeTiles';
import { TodayFeed } from './today/TodayFeed';
import { useTaskActions } from './today/useTaskActions';
import { useTodayData } from './today/useTodayData';
import { useWhySheet } from './today/useWhySheet';
import { trackHomeTile } from './today/trackHomeTile';
import { homeGreeting } from './today/helpers';
import { formatGreetingDate } from './today/greetingDate';
import {
  buildTodayFeed, trackerSummary, trackerTileMeta, caseTileMeta, diaryTileMeta,
} from './today/todayFeed';

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes'; highlight?: string }) => void;
  onOpenAdvanced: () => void;
  onOpenTracker: () => void;
  onOpenTrackerHistory?: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
  refreshKey?: number;
  onTasksChanged?: () => void;
}

// Главная «Сегодня» (docs/design/CLIENT_SIMPLE_2026-10.md): три плитки —
// трекер, «Что случилось», дневник; задания терапевта, лента дня и выход к
// «Подышим». Настройки экрана, фокуса дня, серии и фразы на сайте нет.
export function TodaySection({
  needs, ratings, onNavigate, onOpenSchema, onOpenAdvanced, onOpenTracker, onOpenTrackerHistory,
  onOpenDiaries, onOpenChildhoodWheel, refreshKey, onTasksChanged,
}: Props) {
  const data = useTodayData(refreshKey);
  const { profile, feed, caseCount, caseToday, lastAt, diariesLoaded, reloadDiaries } = data;
  const { tasks, taskHistory, taskError, completeTask, afterCreate } = useTaskActions(refreshKey);
  const [caseOpen,       setCaseOpen]       = useState(false);
  const [showDiaryTask,  setShowDiaryTask]  = useState(false);
  const [showAllTasks,   setShowAllTasks]   = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [introSchemaId,  setIntroSchemaId]  = useState<string | null>(null);
  const [introModeId,    setIntroModeId]    = useState<string | null>(null);
  const [activeTaskId,   setActiveTaskId]   = useState<number | null>(null);

  const tracker = trackerSummary(needs.map(n => n.id), ratings);
  const why = useWhySheet({
    ready: profile !== null && diariesLoaded,
    hasHistory: tracker.filled > 0 || lastAt !== null,
  });

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

  const firstName = profile?.name?.split(' ')[0] ?? '';
  const hasTasks = tasks.length > 0 || taskError;
  const fromTherapist = tasks.some(t => t.assignedBy !== null);

  return (
    <div className="ds-page ct-page">
      <header className="ct-head">
        <div className="ct-head-text">
          <div className="ds-eyebrow">{formatGreetingDate()}</div>
          <h1 className="ds-h1 ct-h1">{homeGreeting(firstName)}</h1>
        </div>
        <button type="button" className="ct-link ct-head-why" onClick={why.open}>Зачем это?</button>
      </header>

      <HomeTiles
        ratings={ratings}
        trackerMeta={trackerTileMeta(tracker)}
        caseMeta={caseTileMeta(caseToday)}
        diaryMeta={diaryTileMeta(diariesLoaded, feed.length, lastAt)}
        onTracker={() => { trackHomeTile('tracker'); onOpenTracker(); }}
        onCase={() => { trackHomeTile('case'); setCaseOpen(true); }}
        onDiary={() => { trackHomeTile('diary'); onOpenDiaries(); }}
      />

      <HomeScreenOfferCard />

      {hasTasks && (
        <PracticesBlock
          title={fromTherapist ? 'От терапевта' : 'Задания'}
          tasks={tasks}
          taskError={taskError}
          onStart={handleTaskAction}
          onShowAll={() => setShowAllTasks(true)}
          onAddGoal={() => setShowDiaryTask(true)}
        />
      )}

      <TodayFeed
        entries={buildTodayFeed(feed, tracker)}
        loaded={diariesLoaded}
        onOpenDiaries={onOpenDiaries}
        onOpenTrackerHistory={onOpenTrackerHistory}
        onAll={() => { trackHomeTile('feed_all'); onNavigate('diary'); }}
      />

      <button type="button" className="ct-link ct-calm" onClick={() => { trackHomeTile('calm'); onNavigate('practice'); }}>
        Тяжело прямо сейчас? Подышим →
      </button>

      {why.mode && <WhySheet auto={why.mode === 'auto'} onClose={why.close} />}
      {caseOpen && (
        <CaseFlowHost
          start="flow"
          caseCount={caseCount}
          onClose={() => { setCaseOpen(false); reloadDiaries(); }}
          onOpenTracker={onOpenTracker}
          onOpenSchema={onOpenSchema}
        />
      )}
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
