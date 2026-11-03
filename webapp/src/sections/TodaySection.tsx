import { useState } from 'react';
import type { Need } from '../types';
import type { Section } from '../components/appShell/navigation';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { HomeScreenOfferCard } from '../components/HomeScreenOfferCard';
import { CaseFlowHost } from '../components/caseFlow/CaseFlowHost';
import { WhySheet } from '../components/WhySheet';
import '../styles/client-today.css';
import { AllTasksOverlay } from './today/AllTasksOverlay';
import { PracticesBlock } from './today/PracticesBlock';
import { HomeTiles } from './today/HomeTiles';
import { TodayFeed } from './today/TodayFeed';
import { useTaskActions } from './today/useTaskActions';
import { useTaskLauncher } from './today/useTaskLauncher';
import { TaskExerciseHost } from './today/TaskExerciseHost';
import { useTodayData } from './today/useTodayData';
import { useWhySheet } from './today/useWhySheet';
import { trackHomeTile } from './today/trackHomeTile';
import { homeGreeting } from './today/helpers';
import { formatGreetingDate } from './today/greetingDate';
import { buildTodayFeed, trackerSummary, trackerTileMeta, caseTileMeta, diaryTileMeta } from './today/todayFeed';
import { QuickEntrySheet } from '../components/diary/QuickEntrySheet';
import { TherapyNudgeCard } from '../components/therapy/TherapyNudgeCard';
import { HomeTherapyLine } from './today/HomeTherapyLine';

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes'; highlight?: string }) => void;
  onOpenTracker: () => void;
  onOpenTrackerHistory?: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
  refreshKey?: number;
  onTasksChanged?: () => void;
}

// Главная «Сегодня» (docs/design/CLIENT_SIMPLE_2026-10.md): три плитки — трекер, «Что случилось»,
// дневник (лист QuickEntrySheet); задания терапевта, лента дня и выход к «Подышим».
export function TodaySection({
  needs, ratings, onNavigate, onOpenSchema, onOpenTracker, onOpenTrackerHistory,
  onOpenDiaries, onOpenChildhoodWheel, refreshKey, onTasksChanged,
}: Props) {
  const data = useTodayData(refreshKey);
  const { profile, feed, casesToday, lastAt, diariesLoaded, reloadDiaries, modeEntries } = data;
  const { tasks, taskHistory, taskError, completeTask, afterCreate } = useTaskActions(refreshKey);
  const [caseOpen,       setCaseOpen]       = useState(false);
  const [quickOpen,      setQuickOpen]      = useState(false);
  const [showDiaryTask,  setShowDiaryTask]  = useState(false);
  const [showAllTasks,   setShowAllTasks]   = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);

  const tracker = trackerSummary(needs.map(n => n.id), ratings);
  const why = useWhySheet({
    ready: profile !== null && diariesLoaded,
    hasHistory: tracker.filled > 0 || lastAt !== null,
  });

  // Задание открывает своё упражнение — та же маршрутизация, что у «Практики»
  // (раньше здесь была своя копия, и упражнения открывали настройки).
  const launcher = useTaskLauncher({ onOpenDiaries, onOpenTracker, onOpenChildhoodWheel, onTaskDone: id => completeTask(id, onTasksChanged) });

  const firstName = profile?.name?.split(' ')[0] ?? '';
  const hasTasks = tasks.length > 0 || taskError;
  const fromTherapist = tasks.some(t => t.assignedBy !== null);

  return (
    <div className="ds-page ct-page">
      <header className="ct-head">
        <div className="ct-head-top">
          <div className="ds-eyebrow">{formatGreetingDate()}</div>
          <button type="button" className="ct-link ct-head-why" onClick={why.open}>Зачем это?</button>
        </div>
        <h1 className="ds-h1 ct-h1">{homeGreeting(firstName)}</h1>
      </header>

      <HomeTiles
        ratings={ratings}
        trackerMeta={trackerTileMeta(tracker)}
        caseMeta={caseTileMeta(casesToday)}
        diaryMeta={diaryTileMeta(diariesLoaded, feed.length, lastAt)}
        onTracker={() => { trackHomeTile('tracker'); onOpenTracker(); }}
        onCase={() => { trackHomeTile('case'); setCaseOpen(true); }}
        onDiary={() => { trackHomeTile('diary'); setQuickOpen(true); }}
      />

      <HomeScreenOfferCard />

      {hasTasks && (
        <PracticesBlock
          title={fromTherapist ? 'От терапевта' : 'Задания'}
          tasks={tasks}
          taskError={taskError}
          onStart={launcher.openTask}
          onComplete={task => completeTask(task.id, onTasksChanged)}
          onShowAll={() => setShowAllTasks(true)}
          onAddGoal={() => setShowDiaryTask(true)}
        />
      )}

      <TherapyNudgeCard refreshKey={refreshKey} modeEntries={modeEntries} />

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

      <HomeTherapyLine />

      {quickOpen && <QuickEntrySheet onClose={() => setQuickOpen(false)} onSaved={reloadDiaries} />}
      {why.mode && <WhySheet auto={why.mode === 'auto'} onClose={why.close} />}
      {caseOpen && (
        <CaseFlowHost
          start="flow"
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
      <TaskExerciseHost open={launcher.open} onBack={launcher.close} onComplete={launcher.complete} onOpenTracker={onOpenTracker} />
      {showAllTasks && (
        <AllTasksOverlay
          tasks={tasks}
          taskHistory={taskHistory}
          onClose={() => setShowAllTasks(false)}
          onTaskDone={id => completeTask(id, onTasksChanged)}
          onAddTask={() => { setShowAllTasks(false); setShowTaskCreate(true); }}
        />
      )}
    </div>
  );
}
