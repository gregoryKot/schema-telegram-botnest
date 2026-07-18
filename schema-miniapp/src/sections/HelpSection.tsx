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
import { TaskHistoryList } from '../components/tasks/TaskHistoryList';
import { findLegacyTaskTarget } from '../components/tasks/taskEmoji';
import { BreathingCard } from '../components/BreathingCard';
import { GroundingSheet } from '../components/GroundingSheet';
import { CrisisCard } from '../components/CrisisCard';
import { useTr } from '../utils/addressForm';

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

// iOS-строка по дизайн-макету: плашка-иконка, заголовок с подписью, шеврон.
// Каскадное появление (index → задержка); глушится reduced-motion блоком CSS.
function ToolRow({
  emoji,
  label,
  sub,
  onClick,
  tint = 'var(--accent)',
  danger,
  index = 0,
}: {
  emoji: string;
  label: string;
  sub?: string;
  onClick: () => void;
  tint?: string;
  danger?: boolean;
  index?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: '13px 16px',
        borderRadius: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        minHeight: 66,
        animation: 'slide-up 0.3s ease both',
        animationDelay: `${index * 45}ms`,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          flexShrink: 0,
          background: `color-mix(in srgb, ${tint} 14%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 19,
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: danger ? 'var(--accent-red)' : 'var(--text)',
            lineHeight: 1.3,
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-sub)',
              marginTop: 1,
              lineHeight: 1.4,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <span style={{ color: 'var(--text-faint)', fontSize: 18, flexShrink: 0 }}>
        ›
      </span>
    </button>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10,
    m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
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
  const [showCrisis, setShowCrisis] = useState(false);
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
      style={{
        minHeight: '100vh',
        paddingBottom: 140,
        paddingTop: safeTop,
        animation: 'fade-in 0.25s ease',
        overflowX: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 20px 12px' }}>
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
        {relation?.role === 'client' &&
          relation.nextSession &&
          (() => {
            const [datePart, timePart] = relation.nextSession.includes('T')
              ? relation.nextSession.split('T')
              : [relation.nextSession, null];
            const [y, m, d] = datePart.split('-').map(Number);
            const MONTHS = [
              'янв',
              'фев',
              'мар',
              'апр',
              'май',
              'июн',
              'июл',
              'авг',
              'сен',
              'окт',
              'ноя',
              'дек',
            ];
            const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            const date = new Date(y, m - 1, d);
            const label = `${DAYS[date.getDay()]}, ${d} ${MONTHS[m - 1]}${timePart ? ` · ${timePart}` : ''}`;
            const isToday = datePart === new Date().toISOString().slice(0, 10);
            return (
              <div
                style={{
                  marginTop: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  background: isToday
                    ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                    : 'rgba(var(--fg-rgb),0.05)',
                  border: `1px solid ${isToday ? 'color-mix(in srgb, var(--accent-green) 25%, transparent)' : 'rgba(var(--fg-rgb),0.1)'}`,
                  borderRadius: 20,
                  padding: '5px 12px',
                }}
              >
                <span style={{ fontSize: 13 }}>📅</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isToday
                      ? 'var(--accent-green)'
                      : 'rgba(var(--fg-rgb),0.6)',
                  }}
                >
                  {isToday ? 'Сегодня встреча' : `Встреча: ${label}`}
                </span>
                {relation.partnerName && (
                  <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>
                    с {relation.partnerName}
                  </span>
                )}
              </div>
            );
          })()}
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
          emoji="📞"
          label="Мне очень плохо"
          sub="контакты помощи прямо сейчас"
          tint="var(--accent-red)"
          danger
          index={1}
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
      {showGrounding && (
        <GroundingSheet onClose={() => setShowGrounding(false)} />
      )}
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
        <BottomSheet onClose={() => setShowAllTasks(false)} zIndex={200}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 18,
              paddingTop: 4,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--text)',
                  letterSpacing: '-0.3px',
                  lineHeight: 1.2,
                }}
              >
                Мои цели
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  marginTop: 4,
                }}
              >
                {tasks.length === 0
                  ? 'Поставь себе цель и иди к ней маленькими шагами'
                  : `${tasks.length} ${plural(tasks.length, 'активная', 'активные', 'активных')}${taskHistory.length > 0 ? ` · ${taskHistory.length} выполнено` : ''}`}
              </div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                flexShrink: 0,
                background: 'rgba(251,146,60,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              🎯
            </div>
          </div>

          {/* Active tasks */}
          {tasks.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                background: 'var(--surface)',
                borderRadius: 16,
                border: '1px dashed var(--border-color)',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>✨</div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--text-sub)',
                  lineHeight: 1.55,
                  maxWidth: 240,
                  margin: '0 auto',
                }}
              >
                Пока нет активных целей. Поставь первую — большие изменения
                начинаются с малого.
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={() => openTask(task)}
                  onComplete={
                    task.done === null && task.type === 'custom'
                      ? () =>
                          api
                            .completeTask(task.id, true)
                            .then(() =>
                              Promise.all([
                                api.getTasks(),
                                api.getTaskHistory(),
                              ]),
                            )
                            .then(([t, h]) => {
                              setTasks(t);
                              setTaskHistory(h);
                              onTasksChanged?.();
                            })
                            .catch(() => {})
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* Completed history */}
          <TaskHistoryList taskHistory={taskHistory} variant="full" />

          {/* Add button */}
          <button
            onClick={() => {
              setShowAllTasks(false);
              setShowTaskCreate(true);
            }}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 14,
              border: 'none',
              background:
                'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(167,139,250,0.10))',
              outline: '1px solid rgba(167,139,250,0.28)',
              color: 'var(--accent)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 18,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 17 }}>+</span> Поставить цель
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
