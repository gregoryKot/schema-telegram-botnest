import { useEffect, useState, lazy, Suspense } from 'react';
import { api, type TherapyRelationInfo } from '../api';
import { CHILDHOOD_DONE_KEY } from '../utils/storageKeys';
import { useTr } from '../utils/addressForm';
import { useTaskActions } from './today/useTaskActions';
import { useTaskLauncher } from './today/useTaskLauncher';
import { TaskExerciseHost } from './today/TaskExerciseHost';
import { sessionMoment } from './today/model';
import { CrisisBlock } from './practice/CrisisBlock';
import { HereAndNowBlock } from './practice/HereAndNowBlock';
import { PracticeHeader } from './practice/PracticeHeader';
import { tasksLinkSub } from './practice/tasksLink';
import { TasksHub } from './tasks/TasksHub';
import { PhoneHelpRows } from './practice/PhoneHelpRows';
import { TherapyBridgeCard } from '../components/therapy/TherapyBridgeCard';
import { useIsMobile } from '../components/useIsMobile';
import { ExerciseLibrary } from './practice/ExerciseLibrary';
import { useExerciseStats } from './practice/useExerciseStats';
import { useCatalogCounts } from './practice/catalogCounts';
import { usePracticeTools } from './practice/usePracticeTools';
import { CatalogsBlock } from './practice/CatalogsBlock';
import { useRoutePractice } from './practice/practiceRoute';
import type { ExId } from '../../../shared/src/exercises/exerciseCatalog';
import { isSessionToday, upcomingSession } from '../../../shared/src/therapy/upcomingSession';
import type { PlanFocus } from '../components/plans/planFocus';
import '../styles/client-practice.css';

const ToolsCustomizeSheet = lazy(() => import('../components/quickActions/ToolsCustomizeSheet').then(m => ({ default: m.ToolsCustomizeSheet })));

interface Props {
  onOpenChildhoodWheel: () => void;
  onOpenPractices: () => void;
  /** `focus` — план из общего поиска (practiceRoute). */
  onOpenPlans: (focus?: PlanFocus) => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  onOpenSchema?: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes' }) => void;
  refreshKey?: number;
  onTasksChanged?: () => void;
}

export function PracticeSection({ onOpenChildhoodWheel, onOpenPractices, onOpenPlans, onOpenTracker, onOpenDiaries, onOpenSchema, refreshKey, onTasksChanged }: Props) {
  const tr = useTr();
  const phone = useIsMobile();
  const childhoodDone = !!localStorage.getItem(CHILDHOOD_DONE_KEY);

  const stats = useExerciseStats();
  const catalog = useCatalogCounts();
  const [showTasks, setShowTasks] = useState(false);
  const { tasks, completeTask } = useTaskActions(refreshKey, 'practice.tasks');
  // Задание открывает своё упражнение — маршрут общий с «Сегодня» (useTaskLauncher).
  const launcher = useTaskLauncher({ onOpenDiaries, onOpenTracker, onOpenChildhoodWheel, onTaskDone: id => completeTask(id, onTasksChanged) });
  const openFlashcard = () => launcher.openExercise({ ex: 'flashcard' });
  const [relation,       setRelation]       = useState<TherapyRelationInfo | null | undefined>(undefined);
  const [showCustomize,  setShowCustomize]  = useState(false);
  const { tools, cards, catalogRows } = usePracticeTools({
    goalsCount: tasks.filter(t => t.assignedBy === null).length, catalog, childhoodDone, onOpenPractices, onOpenPlans: () => onOpenPlans(),
    modesRow: { sub: tr('Найди Уязвимого Ребёнка, Критика, Защитника', 'Найдите Уязвимого Ребёнка, Критика, Защитника'), onClick: () => onOpenSchema?.({ tab: 'modes' }) },
  });
  const onSos = tools.isShown('flashcard') ? openFlashcard : undefined;

  const openLibrary = (id: ExId) => { if (id === 'wheel') { onOpenChildhoodWheel(); return; } launcher.openExercise({ ex: id }); };
  // Состояние маршрута: упражнение или «Мои планы» из общего поиска, карточка схемы из «О схеме».
  useRoutePractice({ exercise: openLibrary, plans: onOpenPlans, schemaCard: id => launcher.openExercise({ ex: 'schema', id }) });

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
    return <TaskExerciseHost open={launcher.open} onBack={launcher.close} onComplete={launcher.complete} onOpenTracker={onOpenTracker} onOpenExercise={launcher.openExercise} />;
  }

  const therapistTasks = tasks.filter(t => t.assignedBy !== null && !t.doneToday);
  const myGoals        = tasks.filter(t => t.assignedBy === null);

  return (
    <div className={'ds-page cp-page animate-fade' + (phone ? ' cp-page--phone' : '')}>
      <PracticeHeader phone={phone} banner={sessionBanner} onCustomize={() => setShowCustomize(true)} />
      {/* Герой дыхания, квадраты заземления, «Стопа» и «Мне плохо» (на телефоне «Мне плохо» — в
          листе кризисных строк под квадратами), затем «Помощь рядом» одной полосой (на телефоне —
          раскрытием той же строки; под квадратом с сердцем — без второго). Кризисный путь — до «Инструментов» и заданий. */}
      <div className="cp-block cp-here">
        <HereAndNowBlock compact={phone} headless onSos={phone ? undefined : onSos} extraRows={phone ? <PhoneHelpRows onSteps={onSos} /> : undefined} />
      </div>
      {!phone && <div className="cp-block"><CrisisBlock heading signless={!!onSos} /></div>}

      {/* Мост к терапевту — после быстрых практик и кризисного входа, перед «Инструментами»: кризисный путь остаётся первым. */}
      <TherapyBridgeCard place="practice" />

      {(tools.isShown('tasks') || therapistTasks.length > 0) && (
        <section className="cp-block">
          <div className="ds-rows">
            <button type="button" className="ds-list-row ds-list-row--nav ds-list-row--hover" onClick={() => setShowTasks(true)}>
              <span className="ds-list-body"><span className="ds-list-title">Задания и цели</span><span className="ds-list-sub">{tasksLinkSub(therapistTasks.length, myGoals.length)}</span></span>
              <span className="ds-chev" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      <ExerciseLibrary
        phone={phone}
        stats={stats}
        items={cards}
        onOpen={openLibrary}
      />

      <CatalogsBlock rows={catalogRows} compact={phone} />

      {/* Overlays */}
      {showCustomize && <Suspense fallback={null}><ToolsCustomizeSheet tools={tools} onClose={() => setShowCustomize(false)} /></Suspense>}
      {showTasks && (
        <TasksHub
          onClose={() => setShowTasks(false)}
          onOpenTracker={onOpenTracker}
          onOpenDiaries={onOpenDiaries}
          onOpenChildhoodWheel={onOpenChildhoodWheel}
          refreshKey={refreshKey}
          onTasksChanged={onTasksChanged}
        />
      )}
    </div>
  );
}
