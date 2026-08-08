import { useEffect, useState } from 'react';
import { useSafeTop } from '../utils/safezone';
import { SchemaFlashcard } from '../components/SchemaFlashcard';
import { LetterToSelf } from '../components/LetterToSelf';
import { BeliefCheck } from '../components/BeliefCheck';
import { PhraseCheck } from '../components/PhraseCheck';
import { CrisisSheet } from './helpSection/CrisisSheet';
import { SafePlace } from '../components/SafePlace';
import { WarmWords } from '../components/WarmWords';
import { TherapyNote } from '../components/TherapyNote';
import { CHILDHOOD_DONE_KEY } from '../components/ChildhoodWheelSheet';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { api, UserTask, TherapyRelationInfo } from '../api';
import { TaskRow } from '../components/tasks/TaskRow';
import { findLegacyTaskTarget } from '../components/tasks/taskEmoji';
import { ToolRow } from '../components/ToolRow';
import { SelfHelpSheet } from '../components/SelfHelpDisclaimer';
import { pressable } from '../utils/a11y';
import { BreathingCard } from '../components/BreathingCard';
import { QuickPracticeSheet } from '../components/QuickPracticeSheet';
import { useTr } from '../utils/addressForm';
import { practiceCountLabel } from '../components/PracticeDoneFooter';
import type { QuickPracticeId } from '../../../shared/src/practices/quickPractices';
import { AllTasksSheet } from './helpSection/AllTasksSheet';
import { NextSessionBanner } from './helpSection/NextSessionBanner';
import { ToolsList } from './helpSection/ToolsList';

interface Props {
  onOpenChildhoodWheel: () => void;
  onOpenPractices: () => void;
  onOpenPlans: () => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  practiceCount?: number | null;
  planCount?: number | null;
  refreshKey?: number;
  initialTasks?: UserTask[] | null;
  onTasksChanged?: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
}

export function HelpSection({
  onOpenChildhoodWheel,
  onOpenPractices,
  onOpenPlans,
  onOpenTracker,
  onOpenDiaries,
  practiceCount,
  planCount,
  refreshKey,
  initialTasks,
  onTasksChanged,
}: Props) {
  const safeTop = useSafeTop();
  const childhoodDone = !!localStorage.getItem(CHILDHOOD_DONE_KEY);

  const tr = useTr();
  const [showFlashcard, setShowFlashcard] = useState(false);
  const [showGrounding, setShowGrounding] = useState(false);
  const [showStop, setShowStop] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const [showSelfHelp, setShowSelfHelp] = useState(false);
  const [showBeliefCheck, setShowBeliefCheck] = useState(false);
  const [showPhraseCheck, setShowPhraseCheck] = useState(false);
  const [showLetterToSelf, setShowLetterToSelf] = useState(false);
  const [showSafePlace, setShowSafePlace] = useState(false);
  const [showWarmWords, setShowWarmWords] = useState(false);
  const [introSchemaId, setIntroSchemaId] = useState<string | null>(null);
  const [introModeId, setIntroModeId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [tasks, setTasks] = useState<UserTask[]>(initialTasks ?? []);
  const [taskHistory, setTaskHistory] = useState<UserTask[]>([]);
  const [relation, setRelation] = useState<
    TherapyRelationInfo | null | undefined
  >(initialTasks !== undefined ? null : undefined);
  const [practiceCounts, setPracticeCounts] = useState<Record<
    QuickPracticeId,
    number
  > | null>(null);

  useEffect(() => {
    if (initialTasks !== undefined) setTasks(initialTasks ?? []);
  }, [initialTasks]);

  // Один общий запрос счётчиков на секцию — не по хуку на каждую строку.
  useEffect(() => {
    let ignore = false;
    api
      .getPracticeSessions()
      .then((c) => {
        if (!ignore) setPracticeCounts(c);
      })
      .catch((e) => console.error('getPracticeSessions failed', e));
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getTasks(), api.getTaskHistory()])
      .then(([t, h]) => {
        if (!ignore) {
          setTasks(t);
          setTaskHistory(h);
        }
      })
      .catch((e) => console.error('getTasks/getTaskHistory failed', e));
    api
      .getTherapyRelation()
      .then((r) => {
        if (!ignore) setRelation(r);
      })
      .catch(() => {
        if (!ignore) setRelation(null);
      });
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const therapistTasks = tasks.filter((t) => t.assignedBy !== null);

  function openTask(task: UserTask) {
    setShowAllTasks(false);
    if (task.assignedBy !== null && task.type !== 'custom') {
      setActiveTaskId(task.id);
    }
    switch (task.type) {
      case 'diary_streak':
        onOpenDiaries();
        break;
      case 'tracker_streak':
        onOpenTracker();
        break;
      case 'belief_check':
        setShowBeliefCheck(true);
        break;
      case 'letter_to_self':
        setShowLetterToSelf(true);
        break;
      case 'safe_place':
        setShowSafePlace(true);
        break;
      case 'childhood_wheel':
        onOpenChildhoodWheel();
        break;
      case 'flashcard':
        setShowFlashcard(true);
        break;
      case 'schema_intro':
        if (task.text) setIntroSchemaId(task.text);
        break;
      case 'mode_intro':
        if (task.text) setIntroModeId(task.text);
        break;
      default: {
        // Fallback: raw schema/mode ID stored as text (old task format)
        const legacy = findLegacyTaskTarget(task.text);
        if (legacy?.type === 'schema') setIntroSchemaId(legacy.id);
        else if (legacy?.type === 'mode') setIntroModeId(legacy.id);
        break;
      }
    }
  }

  // Общий рефетч списка задач — раньше три копии этого Promise.all глушили
  // ошибку по отдельности молча; теперь один центр логирования.
  function refreshTasks() {
    return Promise.all([api.getTasks(), api.getTaskHistory()])
      .then(([t, h]) => {
        setTasks(t);
        setTaskHistory(h);
        onTasksChanged?.();
      })
      .catch((e) => console.error('refreshTasks failed', e));
  }

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const taskId = activeTaskId;
    setActiveTaskId(null);
    api
      .completeTask(taskId, true)
      .then(() => refreshTasks())
      .catch((e) => console.error('completeTask failed', e));
  }

  return (
    <div
      className="section-pad"
      style={{
        paddingTop: safeTop,
        animation: 'fade-in 0.25s ease',
        overflowX: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="d-display" style={{ fontSize: 26 }}>
            Здесь и сейчас
          </div>
          <button
            {...pressable(() => setShowSelfHelp(true))}
            aria-label="О границах самопомощи"
            // Роль несёт слово, а слову нужна ширина: в круге 26×26 текст не
            // помещался, и в цель меньше 44 не попасть.
            style={{
              minHeight: 44,
              padding: '6px 12px',
              borderRadius: 999,
              flexShrink: 0,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              color: 'var(--ink-2)',
              background:
                'color-mix(in srgb, var(--accent-yellow) 16%, transparent)',
              display: 'flex',
              alignItems: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Важное о самопомощи
          </button>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {tr(
            'Тяжёлый момент? Начни с одного вдоха',
            'Тяжёлый момент? Начните с одного вдоха',
          )}
        </div>
        {/* Next session banner for clients */}
        <NextSessionBanner relation={relation} />
      </div>

      <div
        style={{
          padding: '0 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* ── «Здесь и сейчас» (дизайн-макет, волна 2): дыхание первым ── */}
        <BreathingCard />

        <div className="section-label" style={{ margin: '8px 4px -4px' }}>
          Если нужно больше
        </div>
        <ToolRow
          label="Заземление 5-4-3-2-1"
          sub={
            practiceCountLabel(practiceCounts?.grounding ?? null) ??
            'вернуться в тело и в комнату'
          }
          index={0}
          onClick={() => setShowGrounding(true)}
        />
        <ToolRow
          label="Техника «Стоп»"
          sub={
            practiceCountLabel(practiceCounts?.stop ?? null) ??
            'пауза между импульсом и действием'
          }
          index={1}
          onClick={() => setShowStop(true)}
        />
        <ToolRow
          label="Мне очень плохо"
          sub="контакты помощи прямо сейчас"
          danger
          index={2}
          onClick={() => setShowCrisis(true)}
        />

        {/* Therapist tasks — shown prominently when assigned */}
        {therapistTasks.filter((t) => !t.doneToday).length > 0 && (
          <div
            style={{
              background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
              border:
                '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
              borderRadius: 18,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 10,
              }}
            >
              От терапевта
            </div>
            {therapistTasks
              .filter((t) => !t.doneToday)
              .map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={() => openTask(task)}
                />
              ))}
          </div>
        )}

        {/* Инструменты — iOS-строки по макету, каскадное появление */}
        <ToolsList
          tasksCount={tasks.length}
          practiceCount={practiceCount}
          planCount={planCount}
          childhoodDone={childhoodDone}
          onOpenTasks={() => setShowAllTasks(true)}
          onOpenPractices={onOpenPractices}
          onOpenPlans={onOpenPlans}
          onOpenBeliefCheck={() => setShowBeliefCheck(true)}
          onOpenPhraseCheck={() => setShowPhraseCheck(true)}
          onOpenSafePlace={() => setShowSafePlace(true)}
          onOpenLetterToSelf={() => setShowLetterToSelf(true)}
          onOpenFlashcard={() => setShowFlashcard(true)}
          onOpenChildhoodWheel={onOpenChildhoodWheel}
          onOpenWarmWords={() => setShowWarmWords(true)}
        />

        <div style={{ paddingBottom: 4 }}>
          <TherapyNote compact />
        </div>
      </div>

      {showFlashcard && (
        <SchemaFlashcard
          onClose={() => setShowFlashcard(false)}
          onOpenTracker={onOpenTracker}
          onComplete={handleTaskComplete}
        />
      )}
      {showBeliefCheck && (
        <BeliefCheck
          onClose={() => setShowBeliefCheck(false)}
          onComplete={handleTaskComplete}
        />
      )}
      {showPhraseCheck && (
        <PhraseCheck
          onClose={() => setShowPhraseCheck(false)}
          onComplete={handleTaskComplete}
        />
      )}
      {showLetterToSelf && (
        <LetterToSelf
          onClose={() => setShowLetterToSelf(false)}
          onComplete={handleTaskComplete}
        />
      )}
      {showSafePlace && (
        <SafePlace
          onClose={() => setShowSafePlace(false)}
          onComplete={handleTaskComplete}
        />
      )}
      {showWarmWords && <WarmWords onClose={() => setShowWarmWords(false)} />}
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
      {showSelfHelp && (
        <SelfHelpSheet
          onClose={() => setShowSelfHelp(false)}
          onOpenCrisis={() => {
            setShowSelfHelp(false);
            setShowCrisis(true);
          }}
        />
      )}
      {showGrounding && (
        <QuickPracticeSheet
          id="grounding"
          onClose={() => setShowGrounding(false)}
        />
      )}
      {showStop && (
        <QuickPracticeSheet id="stop" onClose={() => setShowStop(false)} />
      )}
      {showCrisis && <CrisisSheet onClose={() => setShowCrisis(false)} />}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => {
            setShowTaskCreate(false);
            void refreshTasks();
          }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      {showAllTasks && (
        <AllTasksSheet
          tasks={tasks}
          taskHistory={taskHistory}
          onClose={() => setShowAllTasks(false)}
          onOpenTask={openTask}
          onReload={() => refreshTasks()}
          onAdd={() => {
            setShowAllTasks(false);
            setShowTaskCreate(true);
          }}
        />
      )}
    </div>
  );
}
