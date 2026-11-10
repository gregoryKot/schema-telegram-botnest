import { useEffect, useState, lazy, Suspense } from 'react';
import { PaperEmpty } from '../components/art/PaperEmpty';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { CHILDHOOD_DONE_KEY } from '../utils/storageKeys';
import type { TherapyRelationInfo } from '../api';
import { pressable } from '../utils/a11y';
import { useTr } from '../utils/addressForm';
import { useTaskActions } from './today/useTaskActions';
import { useTaskLauncher } from './today/useTaskLauncher';
import { TaskExerciseHost } from './today/TaskExerciseHost';
import { sessionMoment } from './today/model';
import { CrisisBlock } from './practice/CrisisBlock';
import { HereAndNowBlock } from './practice/HereAndNowBlock';
import { PracticeHeader } from './practice/PracticeHeader';
import { PhoneHelpRows } from './practice/PhoneHelpRows';
import { TherapyBridgeCard } from '../components/therapy/TherapyBridgeCard';
import { useIsMobile } from '../components/useIsMobile';
import { ExerciseLibrary } from './practice/ExerciseLibrary';
import { TaskRow } from './practice/TaskRow';
import { AllTasksOverlay, TaskSaveError } from './today/AllTasksOverlay';
import { useExerciseStats } from './practice/useExerciseStats';
import { useCatalogCounts } from './practice/catalogCounts';
import { usePracticeTools } from './practice/usePracticeTools';
import { CatalogsBlock } from './practice/CatalogsBlock';
import { pluralRu as plural } from '../../../shared/src/utils/pluralRu';
import { isSessionToday, upcomingSession } from '../../../shared/src/therapy/upcomingSession';
import '../styles/client-practice.css';

const ToolsCustomizeSheet = lazy(() => import('../components/quickActions/ToolsCustomizeSheet').then(m => ({ default: m.ToolsCustomizeSheet })));

interface Props {
  onOpenChildhoodWheel: () => void;
  onOpenPractices: () => void;
  onOpenPlans: () => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  onOpenSchema?: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes' }) => void;
  refreshKey?: number;
  onTasksChanged?: () => void;
}

export function PracticeSection({ onOpenChildhoodWheel, onOpenPractices, onOpenPlans, onOpenTracker, onOpenDiaries, onOpenSchema, refreshKey, onTasksChanged }: Props) {
  const tr = useTr();
  const phone = useIsMobile();
  const location = useLocation();
  const childhoodDone = !!localStorage.getItem(CHILDHOOD_DONE_KEY);

  const stats = useExerciseStats();
  const catalog = useCatalogCounts();
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [showAllGoals,   setShowAllGoals]   = useState(false);
  const { tasks, taskHistory, taskError, completeTask, afterCreate } = useTaskActions(refreshKey, 'practice.tasks');
  // Задание открывает своё упражнение — маршрут общий с «Сегодня» (useTaskLauncher).
  const launcher = useTaskLauncher({ onOpenDiaries, onOpenTracker, onOpenChildhoodWheel, onTaskDone: id => completeTask(id, onTasksChanged) });
  const openFlashcard = () => launcher.openExercise({ ex: 'flashcard' });
  const [relation,       setRelation]       = useState<TherapyRelationInfo | null | undefined>(undefined);
  const [showCustomize,  setShowCustomize]  = useState(false);
  const { tools, cards, catalogRows } = usePracticeTools({
    goalsCount: tasks.filter(t => t.assignedBy === null).length, catalog, childhoodDone, onOpenPractices, onOpenPlans,
    modesRow: { sub: tr('Найди Уязвимого Ребёнка, Критика, Защитника', 'Найдите Уязвимого Ребёнка, Критика, Защитника'), onClick: () => onOpenSchema?.({ tab: 'modes' }) },
  });
  const onSos = tools.isShown('flashcard') ? openFlashcard : undefined;

  // Detect openSchemaEx state from navigation. «Мне плохо» топбара сюда больше
  // не ведёт — карточка открывается поверх текущего раздела (AppOverlays).
  useEffect(() => {
    const state = location.state as { openSchemaEx?: string } | null;
    if (state?.openSchemaEx) {
      launcher.openExercise({ ex: 'schema', id: state.openSchemaEx });
      window.history.replaceState({}, '', '/practice');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно неполные зависимости (mount-only / стабильные ссылки); добавление рискует ре-фетч-циклами
  }, []);

  useEffect(() => {
    let ignore = false;
    api.getTherapyRelation().then(r => { if (!ignore) setRelation(r); }).catch(() => { if (!ignore) setRelation(null); });
    return () => { ignore = true; };
  }, [refreshKey]);

  const sessionBanner = (() => {
    if (relation?.role !== 'client') return null;
    const at = upcomingSession(relation.nextSession, relation.meetingDays);
    if (!at) return null;
    const label = sessionMoment(at).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
    const isToday = isSessionToday(at);
    return { label, isToday, partnerName: relation.partnerName };
  })();

  // Открытое упражнение — на весь экран вместо страницы.
  if (launcher.open) {
    return <TaskExerciseHost open={launcher.open} onBack={launcher.close} onComplete={launcher.complete} onOpenTracker={onOpenTracker} />;
  }

  const therapistTasks = tasks.filter(t => t.assignedBy !== null && !t.doneToday);
  // Серия, сделанная сегодня, остаётся в списке серой (как в мини-аппе), а не пропадает до завтра.
  const myGoals        = tasks.filter(t => t.assignedBy === null);

  return (
    <div className={'ds-page cp-page animate-fade' + (phone ? ' cp-page--phone' : '')}>
      <PracticeHeader phone={phone} banner={sessionBanner} onCustomize={() => setShowCustomize(true)} />
      {/* Герой дыхания, квадраты заземления, «Стопа» и «Мне плохо» (на телефоне «Мне плохо» — в
          листе кризисных строк под квадратами), затем «Помощь рядом» одной полосой (на телефоне —
          раскрытием той же строки). Кризисный путь — до «Инструментов» и заданий. */}
      <div className="cp-block cp-here">
        <HereAndNowBlock compact={phone} onSos={phone ? undefined : onSos} extraRows={phone ? <PhoneHelpRows onSteps={onSos} /> : undefined} />
      </div>
      {!phone && <div className="cp-block"><CrisisBlock heading /></div>}

      {/* Мост к терапевту — после быстрых практик и кризисного входа, перед «Инструментами»: кризисный путь остаётся первым. */}
      <TherapyBridgeCard place="practice" />

      {(therapistTasks.length > 0 || taskError) && (
        <section className="cp-block">
          <div className="ds-head-row">
            <h3 className="ds-h2">От терапевта</h3>
            {therapistTasks.length > 0 && <span className="ds-sub">{therapistTasks.length} {plural(therapistTasks.length, 'задание', 'задания', 'заданий')}</span>}
          </div>
          {taskError && <TaskSaveError className="cp-alert" />}
          <div className="cp-tasks">
            {therapistTasks.map(task => (
              <TaskRow key={task.id} task={task} compact={phone} cta="начать →" onOpen={() => launcher.openTask(task)} onComplete={() => completeTask(task.id, onTasksChanged)} />
            ))}
          </div>
        </section>
      )}

      <ExerciseLibrary
        phone={phone}
        stats={stats}
        items={cards}
        onOpen={id => { if (id === 'wheel') { onOpenChildhoodWheel(); return; } launcher.openExercise({ ex: id }); }}
      />

      {tools.isShown('tasks') && <section className="cp-block">
        <div className="ds-head-row">
          <h3 className="ds-h2">Мои цели</h3>
          <span className="ds-sub">{myGoals.length === 0 ? 'нет активных' : `${myGoals.length} ${plural(myGoals.length, 'активная', 'активные', 'активных')}`}</span>
        </div>
        {myGoals.length === 0 ? (
          <PaperEmpty>{tr('Поставь цель и иди к ней маленькими шагами.', 'Поставьте цель и идите к ней маленькими шагами.')}</PaperEmpty>
        ) : (
          <div className="cp-tasks">
            {myGoals.slice(0, 4).map(task => (
              <TaskRow key={task.id} task={task} compact={phone} cta="открыть →" onOpen={() => launcher.openTask(task)} onComplete={() => completeTask(task.id, onTasksChanged)} />
            ))}
          </div>
        )}
        <div className="cp-actions">
          <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setShowTaskCreate(true)}>+ Поставить цель</button>
          {(myGoals.length > 4 || taskHistory.length > 0) && (
            <span className="ds-link" {...pressable(() => setShowAllGoals(true))}>все цели →</span>
          )}
        </div>
      </section>}

      <CatalogsBlock rows={catalogRows} compact={phone} />

      {/* Overlays */}
      {showCustomize && <Suspense fallback={null}><ToolsCustomizeSheet tools={tools} onClose={() => setShowCustomize(false)} /></Suspense>}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => { setShowTaskCreate(false); void afterCreate(onTasksChanged); /* сбой ловит сам: taskError */ }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      {showAllGoals && (
        <AllTasksOverlay
          title="Все цели"
          tasks={tasks}
          taskHistory={taskHistory}
          onClose={() => setShowAllGoals(false)}
          onOpen={launcher.openTask}
          onComplete={t => completeTask(t.id, onTasksChanged)}
          onAdd={() => setShowTaskCreate(true)}
          error={taskError}
        />
      )}
    </div>
  );
}
