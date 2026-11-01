import { useEffect, useState, lazy, Suspense } from 'react';
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
import { PracticeTopRow, HERE_BLOCK_ID, HELP_BLOCK_ID } from './practice/PracticeTopRow';
import { PracticeHeader } from './practice/PracticeHeader';
import { PhoneHelpRows } from './practice/PhoneHelpRows';
import { useIsMobile } from '../components/useIsMobile';
import { ExerciseLibrary } from './practice/ExerciseLibrary';
import { TaskRow } from './practice/TaskRow';
import { AllGoalsOverlay } from './practice/AllGoalsOverlay';
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
  });

  // Detect openSchemaEx state from navigation
  useEffect(() => {
    const state = location.state as { openSchemaEx?: string; openFlashcard?: boolean } | null;
    if (state?.openFlashcard === true) {
      openFlashcard();
      window.history.replaceState({}, '', '/practice');
    }
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

      {phone ? (
        <div id={HERE_BLOCK_ID} className="cp-block">
          <HereAndNowBlock compact extraRows={<PhoneHelpRows onSteps={tools.isShown('flashcard') ? openFlashcard : undefined} />} />
        </div>
      ) : (
        <>
          <PracticeTopRow onCrisis={tools.isShown('flashcard') ? openFlashcard : undefined} />
          <div id={HERE_BLOCK_ID} className="cp-block"><HereAndNowBlock /></div>
          <div id={HELP_BLOCK_ID} className="cp-block"><CrisisBlock /></div>
        </>
      )}

      {(therapistTasks.length > 0 || taskError) && (
        <section className="cp-block">
          <div className="ds-head-row">
            <h3 className="ds-h2">От терапевта</h3>
            {therapistTasks.length > 0 && <span className="ds-sub">{therapistTasks.length} {plural(therapistTasks.length, 'задание', 'задания', 'заданий')}</span>}
          </div>
          {taskError && (
            <div role="alert" className="cp-alert">
              {tr('Не удалось сохранить изменение задания. Проверь соединение и попробуй ещё раз', 'Не удалось сохранить изменение задания. Проверьте соединение и попробуйте ещё раз')}
            </div>
          )}
          <div className="cp-tasks">
            {therapistTasks.map(task => (
              <TaskRow key={task.id} task={task} mark cta="начать →" onOpen={() => launcher.openTask(task)} onComplete={() => completeTask(task.id, onTasksChanged)} />
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

      <section className="cp-block">
        <div className="ds-head-row"><h3 className="ds-h2">В трудный момент</h3></div>
        <div className="cp-tools">
          {[
            { label: 'Тест на схемы',   sub: tr('116 вопросов, 20 шкал схем – узнай свои паттерны', '116 вопросов, 20 шкал схем – узнайте свои паттерны'),   onClick: () => onOpenSchema?.({ startTest: true }) },
            { label: 'Карта режимов',   sub: tr('Найди Уязвимого Ребёнка, Критика, Защитника', 'Найдите Уязвимого Ребёнка, Критика, Защитника'),         onClick: () => onOpenSchema?.({ tab: 'modes' }) },
          ].map(item => (
            <div key={item.label} className="ds-card ds-card--hover cp-tool" {...pressable(item.onClick)}>
              <div className="cp-tool-title">{item.label}</div>
              <div className="cp-tool-sub">{item.sub}</div>
              <span className="ds-link">начать →</span>
            </div>
          ))}
        </div>
      </section>

      {tools.isShown('tasks') && <section className="cp-block">
        <div className="ds-head-row">
          <h3 className="ds-h2">Мои цели</h3>
          <span className="ds-sub">{myGoals.length === 0 ? 'нет активных' : `${myGoals.length} ${plural(myGoals.length, 'активная', 'активных', 'активных')}`}</span>
        </div>
        {myGoals.length === 0 ? (
          <div className="cp-empty">
            {tr('Поставь цель и иди к ней маленькими шагами.', 'Поставьте цель и идите к ней маленькими шагами.')}
          </div>
        ) : (
          <div className="cp-tasks">
            {myGoals.slice(0, 4).map(task => (
              <TaskRow key={task.id} task={task} cta="открыть →" onOpen={() => launcher.openTask(task)} onComplete={() => completeTask(task.id, onTasksChanged)} />
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

      <CatalogsBlock rows={catalogRows} />

      {/* Overlays */}
      {showCustomize && <Suspense fallback={null}><ToolsCustomizeSheet tools={tools} onClose={() => setShowCustomize(false)} /></Suspense>}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => { setShowTaskCreate(false); afterCreate(onTasksChanged); }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      {showAllGoals && (
        <AllGoalsOverlay
          tasks={tasks}
          taskHistory={taskHistory}
          onClose={() => setShowAllGoals(false)}
          onOpen={t => { setShowAllGoals(false); launcher.openTask(t); }}
          onComplete={t => completeTask(t.id, onTasksChanged)}
          onAdd={() => { setShowAllGoals(false); setShowTaskCreate(true); }}
        />
      )}
    </div>
  );
}
