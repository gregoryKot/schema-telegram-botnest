import { useEffect, useState, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { Loader } from '../components/Loader';
import { SchemaFlashcard } from '../components/SchemaFlashcard';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { CHILDHOOD_DONE_KEY } from '../utils/storageKeys';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapyData';
import type { UserTask, TherapyRelationInfo } from '../api';
import { pressable } from '../utils/a11y';
import { useTr } from '../utils/addressForm';
import { useTaskActions } from './today/useTaskActions';
import { CrisisBlock } from './practice/CrisisBlock';
import { HereAndNowBlock } from './practice/HereAndNowBlock';
import { PracticeTopRow, HERE_BLOCK_ID, HELP_BLOCK_ID } from './practice/PracticeTopRow';
import { ExerciseLibrary } from './practice/ExerciseLibrary';
import { TaskRow } from './practice/TaskRow';
import { AllGoalsOverlay } from './practice/AllGoalsOverlay';
import { useExerciseStats } from './practice/useExerciseStats';
import type { ExId } from './practice/exerciseLibrary';
import { pluralRu as plural } from '../../../shared/src/utils/pluralRu';
import { todayCalendarDate } from '../../../shared/src/utils/calendarDate';
import '../styles/client-practice.css';

const BeliefCheckEx    = lazy(() => import('../components/exercises/BeliefCheckEx').then(m => ({ default: m.BeliefCheckEx })));
const SchemaEx         = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.SchemaEx })));
const ModeEx           = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));
const LetterEx         = lazy(() => import('../components/exercises/LetterEx').then(m => ({ default: m.LetterEx })));
const SafePlaceEx      = lazy(() => import('../components/exercises/SafePlaceEx').then(m => ({ default: m.SafePlaceEx })));
const ChildhoodWheelEx = lazy(() => import('../components/exercises/ChildhoodWheelEx').then(m => ({ default: m.ChildhoodWheelEx })));
const WarmWordsEx      = lazy(() => import('../components/exercises/WarmWordsEx').then(m => ({ default: m.WarmWordsEx })));
const PhraseCheckEx    = lazy(() => import('../components/exercises/PhraseCheckEx').then(m => ({ default: m.PhraseCheckEx })));

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
  const location = useLocation();
  const childhoodDone = !!localStorage.getItem(CHILDHOOD_DONE_KEY);

  const [openEx,         setOpenEx]         = useState<ExId | null>(null);
  const [schemaInitialId, setSchemaInitialId] = useState<string | undefined>(undefined);
  const stats = useExerciseStats();
  const [showFlashcard,  setShowFlashcard]  = useState(false);
  const [_introSchemaId, _setIntroSchemaId] = useState<string | null>(null);
  const [introModeId,    setIntroModeId]    = useState<string | null>(null);
  const [activeTaskId,   setActiveTaskId]   = useState<number | null>(null);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [showAllGoals,   setShowAllGoals]   = useState(false);
  const { tasks, taskHistory, taskError, completeTask, afterCreate } = useTaskActions(refreshKey, 'practice.tasks');
  const [relation,       setRelation]       = useState<TherapyRelationInfo | null | undefined>(undefined);

  // Detect openSchemaEx state from navigation
  useEffect(() => {
    const state = location.state as { openSchemaEx?: string; openFlashcard?: boolean } | null;
    if (state?.openFlashcard === true) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренно: загрузка/сброс состояния при монтировании или смене зависимости (fetch-эффект); рефактор на key/data-layer — отдельная задача
      setShowFlashcard(true);
      window.history.replaceState({}, '', '/practice');
    }
    if (state?.openSchemaEx) {
      setOpenEx('schema');
      setSchemaInitialId(state.openSchemaEx);
      window.history.replaceState({}, '', '/practice');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно неполные зависимости (mount-only / стабильные ссылки); добавление рискует ре-фетч-циклами
  }, []);

  useEffect(() => {
    let ignore = false;
    api.getTherapyRelation().then(r => { if (!ignore) setRelation(r); }).catch(() => { if (!ignore) setRelation(null); });
    return () => { ignore = true; };
  }, [refreshKey]);

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const id = activeTaskId;
    setActiveTaskId(null);
    completeTask(id, onTasksChanged);
  }

  function openTask(task: UserTask) {
    if (task.assignedBy !== null && task.type !== 'custom') setActiveTaskId(task.id);
    switch (task.type) {
      case 'diary_streak':    onOpenDiaries(); break;
      case 'tracker_streak':  onOpenTracker(); break;
      case 'belief_check':    setOpenEx('belief'); break;
      case 'letter_to_self':  setOpenEx('letter'); break;
      case 'safe_place':      setOpenEx('safe'); break;
      case 'childhood_wheel': onOpenChildhoodWheel(); break;
      case 'flashcard':       setShowFlashcard(true); break;
      case 'schema_intro':    if (task.text) { setSchemaInitialId(task.text); setOpenEx('schema'); } break;
      case 'mode_intro':      if (task.text) { setIntroModeId(task.text); } break;
      default:
        if (ALL_SCHEMAS.some(s => s.id === task.text)) { setSchemaInitialId(task.text); setOpenEx('schema'); break; }
        if (ALL_MODES.some(m => m.id === task.text)) { setIntroModeId(task.text); break; }
    }
  }

  const sessionBanner = (() => {
    if (relation?.role !== 'client' || !relation.nextSession) return null;
    const label = new Date(relation.nextSession).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
    const isToday = relation.nextSession.slice(0, 10) === todayCalendarDate();
    return { label, isToday, partnerName: relation.partnerName };
  })();

  // If exercise open, render it full-screen
  if (openEx) {
    const onBack = () => { setOpenEx(null); setSchemaInitialId(undefined); };
    return (
      <Suspense fallback={<Loader minHeight="100dvh" />}>
        {openEx === 'belief' && <BeliefCheckEx onBack={onBack} onComplete={handleTaskComplete} />}
        {openEx === 'schema' && <SchemaEx onBack={onBack} initialSchemaId={schemaInitialId} onComplete={handleTaskComplete} />}
        {openEx === 'mode'   && <ModeEx onBack={onBack} onComplete={handleTaskComplete} />}
        {openEx === 'letter' && <LetterEx onBack={onBack} onComplete={handleTaskComplete} />}
        {openEx === 'safe'   && <SafePlaceEx onBack={onBack} onComplete={handleTaskComplete} />}
        {openEx === 'wheel'  && <ChildhoodWheelEx onBack={onBack} />}
        {openEx === 'warm'   && <WarmWordsEx onBack={onBack} />}
        {openEx === 'phrase' && <PhraseCheckEx onBack={onBack} onComplete={handleTaskComplete} />}
      </Suspense>
    );
  }
  if (introModeId) return (
    <div className="u-sheet">
      <Suspense fallback={null}><ModeEx onBack={() => setIntroModeId(null)} initialModeId={introModeId} onComplete={() => { setIntroModeId(null); handleTaskComplete(); }} /></Suspense>
    </div>
  );

  const therapistTasks = tasks.filter(t => t.assignedBy !== null && !t.doneToday);
  const myGoals        = tasks.filter(t => t.assignedBy === null  && !t.doneToday);

  return (
    <div className="ds-page cp-page animate-fade">

      <div>
        <div className="ds-eyebrow">Практика</div>
        <h1 className="ds-h1">Упражнения <i>и задания</i></h1>
        <p className="ds-sub" style={{ fontSize: 15, marginTop: 12 }}>
          {tr('Восемь практик схема-терапии плюс твои личные цели.', 'Восемь практик схема-терапии плюс ваши личные цели.')}
        </p>
        {sessionBanner && (
          <div className="ds-sub" style={{ marginTop: 8, color: sessionBanner.isToday ? 'var(--ok-ink)' : undefined }}>
            {sessionBanner.isToday ? '● Сегодня встреча' : `Следующая встреча: ${sessionBanner.label}`}
            {sessionBanner.partnerName && <span> · с {sessionBanner.partnerName}</span>}
          </div>
        )}
      </div>

      <PracticeTopRow onCrisis={() => setShowFlashcard(true)} />

      <div id={HERE_BLOCK_ID} className="cp-block"><HereAndNowBlock /></div>

      <div id={HELP_BLOCK_ID} className="cp-block"><CrisisBlock /></div>

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
              <TaskRow key={task.id} task={task} mark cta="начать →" onOpen={() => openTask(task)} />
            ))}
          </div>
        </section>
      )}

      <ExerciseLibrary stats={stats} onOpen={id => { setSchemaInitialId(undefined); setOpenEx(id); }} />

      <section className="cp-block">
        <div className="ds-head-row"><h3 className="ds-h2">В трудный момент</h3></div>
        <div className="cp-tools">
          {[
            { label: 'Тест на схемы',   sub: tr('116 вопросов, 20 шкал схем – узнай свои паттерны', '116 вопросов, 20 шкал схем – узнайте свои паттерны'),   onClick: () => onOpenSchema?.({ startTest: true }) },
            { label: 'Карта режимов',   sub: tr('Найди Уязвимого Ребёнка, Критика, Защитника', 'Найдите Уязвимого Ребёнка, Критика, Защитника'),         onClick: () => onOpenSchema?.({ tab: 'modes' }) },
            { label: 'Колесо детства',  sub: 'Как удовлетворялись потребности в детстве',           onClick: onOpenChildhoodWheel, done: childhoodDone },
          ].map(item => (
            <div key={item.label} className="ds-card ds-card--hover cp-tool" {...pressable(item.onClick)}>
              <div className="cp-tool-title">{item.label}</div>
              <div className="cp-tool-sub">{item.sub}</div>
              <span className="ds-link">{'done' in item && item.done ? 'открыть →' : 'начать →'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cp-block">
        <div className="ds-head-row">
          <h3 className="ds-h2">Мои цели</h3>
          <span className="ds-sub">{myGoals.length === 0 ? 'нет активных' : `${myGoals.length} активных`}</span>
        </div>
        {myGoals.length === 0 ? (
          <div className="cp-empty">
            {tr('Поставь цель и иди к ней маленькими шагами.', 'Поставьте цель и идите к ней маленькими шагами.')}
          </div>
        ) : (
          <div className="cp-tasks">
            {myGoals.slice(0, 4).map(task => (
              <TaskRow key={task.id} task={task} cta="открыть →" onOpen={() => openTask(task)} />
            ))}
          </div>
        )}
        <div className="cp-actions">
          <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setShowTaskCreate(true)}>+ Поставить цель</button>
          {(myGoals.length > 4 || taskHistory.length > 0) && (
            <span className="ds-link" {...pressable(() => setShowAllGoals(true))}>все цели →</span>
          )}
        </div>
      </section>

      <section className="cp-block">
        <div className="ds-head-row"><h3 className="ds-h2">Каталоги</h3></div>
        <div className="cp-tasks">
          {[
            { label: 'Практики',  sub: 'Рекомендованные упражнения по потребностям', onClick: onOpenPractices },
            { label: 'Планы',     sub: 'Планы поддержки и кризисов',                  onClick: onOpenPlans },
          ].map(item => (
            <div key={item.label} className="ds-card ds-card--row ds-card--hover cp-task" {...pressable(item.onClick)}>
              <div className="cp-task-body">
                <div className="cp-task-title">{item.label}</div>
                <div className="ds-sub">{item.sub}</div>
              </div>
              <span className="ds-link">открыть →</span>
            </div>
          ))}
        </div>
      </section>

      {/* Overlays */}
      {showFlashcard && <SchemaFlashcard onClose={() => setShowFlashcard(false)} onOpenTracker={onOpenTracker} onComplete={handleTaskComplete} />}
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
          onOpen={t => { setShowAllGoals(false); openTask(t); }}
          onAdd={() => { setShowAllGoals(false); setShowTaskCreate(true); }}
        />
      )}
    </div>
  );
}
