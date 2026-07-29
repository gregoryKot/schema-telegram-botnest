import { useEffect, useState } from 'react';
import { useSafeTop } from '../utils/safezone';
import { SchemaFlashcard } from '../components/SchemaFlashcard';
import { LetterToSelf } from '../components/LetterToSelf';
import { BeliefCheck } from '../components/BeliefCheck';
import { SafePlace } from '../components/SafePlace';
import { TherapyNote } from '../components/TherapyNote';
import { CHILDHOOD_DONE_KEY } from '../components/ChildhoodWheelSheet';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { api, UserTask, TherapyRelationInfo } from '../api';
import { BottomSheet } from '../components/BottomSheet';
import { TaskRow } from '../components/tasks/TaskRow';
import { findLegacyTaskTarget } from '../components/tasks/taskEmoji';
import { ToolRow } from '../components/ToolRow';
import { SelfHelpSheet } from '../components/SelfHelpDisclaimer';
import { pressable } from '../utils/a11y';
import { BreathingCard } from '../components/BreathingCard';
import { GroundingSheet } from '../components/GroundingSheet';
import { StopSheet } from '../components/StopSheet';
import { CrisisCard } from '../components/CrisisCard';
import { useTr } from '../utils/addressForm';
import { plural } from './today/helpers';
import { AllTasksSheet } from './helpSection/AllTasksSheet';
import { NextSessionBanner } from './helpSection/NextSessionBanner';

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
  const [showLetterToSelf, setShowLetterToSelf] = useState(false);
  const [showSafePlace, setShowSafePlace] = useState(false);
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

  useEffect(() => {
    if (initialTasks !== undefined) setTasks(initialTasks ?? []);
  }, [initialTasks]);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getTasks(), api.getTaskHistory()])
      .then(([t, h]) => {
        if (!ignore) {
          setTasks(t);
          setTaskHistory(h);
        }
      })
      .catch(() => {});
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

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const taskId = activeTaskId;
    setActiveTaskId(null);
    api
      .completeTask(taskId, true)
      .then(() => Promise.all([api.getTasks(), api.getTaskHistory()]))
      .then(([t, h]) => {
        setTasks(t);
        setTaskHistory(h);
        onTasksChanged?.();
      })
      .catch(() => {});
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.5px',
            }}
          >
            Здесь и сейчас
          </div>
          <button
            {...pressable(() => setShowSelfHelp(true))}
            aria-label="О границах самопомощи"
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              flexShrink: 0,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 15,
              lineHeight: 1,
              background:
                'color-mix(in srgb, var(--accent-yellow) 16%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ⚠️
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
          emoji="🌍"
          label="Заземление 5-4-3-2-1"
          sub="вернуться в тело и в комнату"
          tint="var(--accent-blue)"
          index={0}
          onClick={() => setShowGrounding(true)}
        />
        <ToolRow
          emoji="🛑"
          label="Техника «Стоп»"
          sub="пауза между импульсом и действием"
          tint="var(--accent-orange)"
          index={1}
          onClick={() => setShowStop(true)}
        />
        <ToolRow
          emoji="📞"
          label="Мне очень плохо"
          sub="контакты помощи прямо сейчас"
          tint="var(--accent-red)"
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
        <div className="section-label" style={{ margin: '8px 4px -4px' }}>
          Инструменты
        </div>
        <ToolRow
          emoji="🎯"
          label="Мои цели"
          sub={
            tasks.length === 0
              ? 'Нет активных'
              : `${tasks.length} ${plural(tasks.length, 'цель', 'цели', 'целей')}`
          }
          tint="var(--accent-orange)"
          index={0}
          onClick={() => setShowAllTasks(true)}
        />
        <ToolRow
          emoji="🗂"
          label="Практики"
          sub={
            practiceCount == null
              ? undefined
              : practiceCount === 0
                ? 'Нет практик'
                : `${practiceCount} ${plural(practiceCount, 'практика', 'практики', 'практик')}`
          }
          tint="var(--accent)"
          index={1}
          onClick={onOpenPractices}
        />
        <ToolRow
          emoji="🗓"
          label="Планы"
          sub={
            planCount == null
              ? undefined
              : planCount === 0
                ? 'История пуста'
                : `${planCount} ${plural(planCount, 'план', 'плана', 'планов')}`
          }
          tint="var(--accent-blue)"
          index={2}
          onClick={onOpenPlans}
        />
        <ToolRow
          emoji="🔍"
          label="Проверка убеждений"
          sub="Правда ли это?"
          tint="var(--accent-yellow)"
          index={3}
          onClick={() => setShowBeliefCheck(true)}
        />
        <ToolRow
          emoji="🏡"
          label="Безопасное место"
          sub="Ресурс в тревожный момент"
          tint="var(--accent-green)"
          index={4}
          onClick={() => setShowSafePlace(true)}
        />
        <ToolRow
          emoji="✉️"
          label="Письмо себе"
          sub="Уязвимому Ребёнку"
          tint="var(--accent-pink)"
          index={5}
          onClick={() => setShowLetterToSelf(true)}
        />
        <ToolRow
          emoji="🆘"
          label="Схема включилась"
          sub="5 шагов чтобы разобраться"
          tint="var(--accent-indigo)"
          index={6}
          onClick={() => setShowFlashcard(true)}
        />
        <ToolRow
          emoji="🌱"
          label="Колесо детства"
          sub={childhoodDone ? 'Паттерны из прошлого' : 'Займёт 2 минуты'}
          tint="var(--accent-green)"
          index={7}
          onClick={onOpenChildhoodWheel}
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
        <GroundingSheet onClose={() => setShowGrounding(false)} />
      )}
      {showStop && <StopSheet onClose={() => setShowStop(false)} />}
      {showCrisis && (
        <BottomSheet onClose={() => setShowCrisis(false)} zIndex={200}>
          <div style={{ paddingTop: 4 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--text)',
                marginBottom: 4,
              }}
            >
              Помощь рядом
            </div>
            <CrisisCard />
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-sub)',
                lineHeight: 1.6,
                marginTop: 4,
              }}
            >
              Если есть угроза жизни — 112. Разговор с близким человеком тоже
              считается: иногда одно сообщение «мне плохо» — уже первый шаг.
            </div>
          </div>
        </BottomSheet>
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
      {showAllTasks && (
        <AllTasksSheet
          tasks={tasks}
          taskHistory={taskHistory}
          onClose={() => setShowAllTasks(false)}
          onOpenTask={openTask}
          onReload={() =>
            Promise.all([api.getTasks(), api.getTaskHistory()])
              .then(([t, h]) => {
                setTasks(t);
                setTaskHistory(h);
                onTasksChanged?.();
              })
              .catch(() => {})
          }
          onAdd={() => {
            setShowAllTasks(false);
            setShowTaskCreate(true);
          }}
        />
      )}
    </div>
  );
}
