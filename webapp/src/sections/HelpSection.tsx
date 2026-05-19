import { useEffect, useState } from 'react';
import { SchemaFlashcard } from '../components/SchemaFlashcard';
import { LetterToSelf } from '../components/LetterToSelf';
import { BeliefCheck } from '../components/BeliefCheck';
import { SafePlace } from '../components/SafePlace';
import { TherapyNote } from '../components/TherapyNote';
import { CHILDHOOD_DONE_KEY } from '../components/ChildhoodWheelSheet';
import { TaskCreateSheet, getTaskDisplayText } from '../components/TaskCreateSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { api } from '../api';
import type { UserTask, TherapyRelationInfo } from '../api';
import { BottomSheet } from '../components/BottomSheet';
import { fmtDate } from '../utils/format';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapyData';

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

function ToolCard({ emoji, label, sub, onClick, accentColor }: { emoji: string; label: string; sub?: string; onClick: () => void; accentColor?: string }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer', padding: '18px 16px', borderRadius: 10,
        background: 'transparent', border: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', gap: 8,
        WebkitTapHighlightColor: 'transparent',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
    >
      <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: accentColor || 'var(--text)', lineHeight: 1.3 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}


const TASK_EMOJI: Record<string, string> = {
  diary_streak: '📔', tracker_streak: '📊', belief_check: '🔍',
  letter_to_self: '✉️', safe_place: '🏡', childhood_wheel: '🌱',
  flashcard: '🆘', schema_intro: '🧩', mode_intro: '🔄', custom: '✏️',
};

// Resolve display text for tasks that may have raw IDs as text
function resolveTaskDisplayText(task: UserTask): string {
  const text = getTaskDisplayText(task.type, task.text);
  // If still raw (didn't resolve via type), try ID lookup
  if (text === task.text) {
    const schema = ALL_SCHEMAS.find(s => s.id === task.text);
    if (schema) return `Карточка схемы: ${schema.name}`;
    const mode = ALL_MODES.find(m => m.id === task.text);
    if (mode) return `Карточка режима: ${mode.name}`;
  }
  return text;
}

function resolveTaskEmoji(task: UserTask): string {
  if (TASK_EMOJI[task.type]) return TASK_EMOJI[task.type];
  // Fallback: check if text is a schema or mode ID
  if (ALL_SCHEMAS.some(s => s.id === task.text)) return '🧩';
  if (ALL_MODES.some(m => m.id === task.text)) return '🔄';
  return '⏳';
}

function TaskRow({ task, onOpen, onComplete }: { task: UserTask; onOpen: () => void; onComplete?: () => void }) {
  const isStreakTask = task.type === 'diary_streak' || task.type === 'tracker_streak';
  const isAssigned = task.assignedBy !== null;
  const [completing, setCompleting] = useState(false);
  const emoji = task.doneToday ? '✅' : resolveTaskEmoji(task);

  return (
    <div
      onClick={task.doneToday ? undefined : onOpen}
      style={{
        padding: '14px',
        background: 'transparent',
        border: `1px solid ${isAssigned && !task.doneToday ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--line)'}`,
        borderRadius: 16,
        marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: task.doneToday ? 'default' : 'pointer',
        opacity: task.doneToday ? 0.55 : 1,
        transition: 'all 0.15s',
      }}
    >
      {/* Icon bubble */}
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: task.doneToday ? 'rgba(52,211,153,0.1)' : 'var(--surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
      }}>
        {emoji}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isAssigned && !task.doneToday && (
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 3 }}>
            от терапевта
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.35 }}>
          {resolveTaskDisplayText(task)}
        </div>
        {task.doneToday && isStreakTask && (
          <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 3 }}>Сделано сегодня — завтра снова</div>
        )}
        <TaskProgressBar task={task} />
        {task.dueDate && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>до {fmtDate(task.dueDate)}</div>}
      </div>

      {/* Action */}
      {!task.doneToday && task.done === null && task.type === 'custom' && onComplete ? (
        <button
          disabled={completing}
          onClick={e => { e.stopPropagation(); setCompleting(true); onComplete(); }}
          style={{ background: 'rgba(52,211,153,0.12)', outline: '1px solid rgba(52,211,153,0.22)', border: 'none', borderRadius: 10, padding: '7px 12px', color: 'var(--accent-green)', fontSize: 12, fontWeight: 600, cursor: completing ? 'default' : 'pointer', flexShrink: 0, opacity: completing ? 0.5 : 1, fontFamily: 'inherit' }}
        >
          {completing ? '...' : 'Готово'}
        </button>
      ) : !task.doneToday && task.type !== 'custom' ? (
        <span style={{ color: 'var(--text-faint)', fontSize: 18, flexShrink: 0 }}>›</span>
      ) : null}
    </div>
  );
}

function TaskProgressBar({ task }: { task: UserTask }) {
  if (task.type === 'custom' || !task.targetDays) return null;
  const target = task.targetDays;
  // Use server-computed progress (actual days done) if available, else fall back to elapsed days
  const progress = task.progress !== undefined ? Math.min(task.progress, target) : 0;
  const pct = target > 0 ? (progress / target) * 100 : 0;
  return (
    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(var(--fg-rgb),0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>{progress}/{target}</span>
    </div>
  );
}

export function HelpSection({ onOpenChildhoodWheel, onOpenPractices, onOpenPlans, onOpenTracker, onOpenDiaries, practiceCount, planCount, refreshKey, initialTasks, onTasksChanged, userRole: _userRole, onOpenTherapistCabinet: _onOpenTherapistCabinet }: Props) {
  const childhoodDone = !!localStorage.getItem(CHILDHOOD_DONE_KEY);

  const [showFlashcard, setShowFlashcard] = useState(false);
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
  const [relation, setRelation] = useState<TherapyRelationInfo | null | undefined>(initialTasks !== undefined ? null : undefined);

  useEffect(() => {
    if (initialTasks !== undefined) setTasks(initialTasks ?? []);
  }, [initialTasks]);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getTasks(), api.getTaskHistory()]).then(([t, h]) => {
      if (!ignore) { setTasks(t); setTaskHistory(h); }
    }).catch(() => {});
    api.getTherapyRelation().then(r => { if (!ignore) setRelation(r); }).catch(() => { if (!ignore) setRelation(null); });
    return () => { ignore = true; };
  }, [refreshKey]);

  const therapistTasks = tasks.filter(t => t.assignedBy !== null);

  function openTask(task: UserTask) {
    setShowAllTasks(false);
    if (task.assignedBy !== null && task.type !== 'custom') {
      setActiveTaskId(task.id);
    }
    switch (task.type) {
      case 'diary_streak':    onOpenDiaries(); break;
      case 'tracker_streak':  onOpenTracker(); break;
      case 'belief_check':    setShowBeliefCheck(true); break;
      case 'letter_to_self':  setShowLetterToSelf(true); break;
      case 'safe_place':      setShowSafePlace(true); break;
      case 'childhood_wheel': onOpenChildhoodWheel(); break;
      case 'flashcard':       setShowFlashcard(true); break;
      case 'schema_intro':    if (task.text) setIntroSchemaId(task.text); break;
      case 'mode_intro':      if (task.text) setIntroModeId(task.text); break;
      default:
        // Fallback: if text is a raw schema/mode ID (old task format)
        if (ALL_SCHEMAS.some(s => s.id === task.text)) { setIntroSchemaId(task.text); break; }
        if (ALL_MODES.some(m => m.id === task.text)) { setIntroModeId(task.text); break; }
        break;
    }
  }

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const taskId = activeTaskId;
    setActiveTaskId(null);
    api.completeTask(taskId, true)
      .then(() => Promise.all([api.getTasks(), api.getTaskHistory()]))
      .then(([t, h]) => { setTasks(t); setTaskHistory(h); onTasksChanged?.(); })
      .catch(() => {});
  }

  return (
    <div className="page-inner">

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 6 }}>Помощь</h1>
        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
          Инструменты и упражнения
        </div>
        {/* Next session banner for clients */}
        {relation?.role === 'client' && relation.nextSession && (() => {
          const [datePart, timePart] = relation.nextSession.includes('T') ? relation.nextSession.split('T') : [relation.nextSession, null];
          const [y, m, d] = datePart.split('-').map(Number);
          const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
          const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
          const date = new Date(y, m - 1, d);
          const label = `${DAYS[date.getDay()]}, ${d} ${MONTHS[m - 1]}${timePart ? ` · ${timePart}` : ''}`;
          const isToday = datePart === new Date().toISOString().slice(0, 10);
          return (
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 7, background: isToday ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)' : 'rgba(var(--fg-rgb),0.05)', border: `1px solid ${isToday ? 'color-mix(in srgb, var(--accent-green) 25%, transparent)' : 'rgba(var(--fg-rgb),0.1)'}`, borderRadius: 20, padding: '5px 12px' }}>
              <span style={{ fontSize: 13 }}>📅</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: isToday ? 'var(--accent-green)' : 'rgba(var(--fg-rgb),0.6)' }}>
                {isToday ? 'Сегодня встреча' : `Встреча: ${label}`}
              </span>
              {relation.partnerName && <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>с {relation.partnerName}</span>}
            </div>
          );
        })()}
      </div>

      <div style={{ maxWidth: 800 }}>

        {/* Therapist tasks — shown prominently when assigned */}
        {therapistTasks.filter(t => !t.doneToday).length > 0 && (
          <div className="section">
            <div className="section-head">
              <h3 style={{ color: 'var(--accent)' }}>От терапевта</h3>
            </div>
            {therapistTasks.filter(t => !t.doneToday).map(task => (
              <TaskRow key={task.id} task={task} onOpen={() => openTask(task)} />
            ))}
          </div>
        )}

        {/* Tool grid */}
        <div className="section">
          <div className="section-head"><h3>Инструменты</h3></div>
          <div className="tool-grid">
            <ToolCard emoji="🎯" label="Мои цели" sub={tasks.length === 0 ? 'Нет активных' : `${tasks.length} ${plural(tasks.length, 'цель', 'цели', 'целей')}`} accentColor="var(--accent-orange)" onClick={() => setShowAllTasks(true)} />
            <ToolCard emoji="🗂" label="Практики" sub={practiceCount == null ? undefined : practiceCount === 0 ? 'Нет практик' : `${practiceCount} ${plural(practiceCount, 'практика', 'практики', 'практик')}`} accentColor="var(--accent)" onClick={onOpenPractices} />
            <ToolCard emoji="🗓" label="Планы" sub={planCount == null ? undefined : planCount === 0 ? 'История пуста' : `${planCount} ${plural(planCount, 'план', 'плана', 'планов')}`} accentColor="var(--accent-blue)" onClick={onOpenPlans} />
            <ToolCard emoji="🔍" label="Проверка убеждений" sub="Правда ли это?" accentColor="var(--accent-yellow)" onClick={() => setShowBeliefCheck(true)} />
            <ToolCard emoji="🏡" label="Безопасное место" sub="Ресурс в тревожный момент" accentColor="var(--accent-green)" onClick={() => setShowSafePlace(true)} />
            <ToolCard emoji="✉️" label="Письмо себе" sub="Уязвимому Ребёнку" accentColor="var(--accent-pink)" onClick={() => setShowLetterToSelf(true)} />
            <ToolCard emoji="🆘" label="Мне плохо" sub="5 шагов чтобы разобраться" accentColor="var(--accent-red)" onClick={() => setShowFlashcard(true)} />
            <ToolCard emoji="🌱" label="Колесо детства" sub={childhoodDone ? 'Паттерны из прошлого' : 'Займёт 2 минуты'} accentColor="var(--accent-green)" onClick={onOpenChildhoodWheel} />
          </div>
        </div>

        <div className="section">
          <TherapyNote compact />
        </div>

      </div>

      {showFlashcard && <SchemaFlashcard onClose={() => setShowFlashcard(false)} onOpenTracker={onOpenTracker} onComplete={handleTaskComplete} />}
      {showBeliefCheck && <BeliefCheck onClose={() => setShowBeliefCheck(false)} onComplete={handleTaskComplete} />}
      {showLetterToSelf && <LetterToSelf onClose={() => setShowLetterToSelf(false)} onComplete={handleTaskComplete} />}
      {showSafePlace && <SafePlace onClose={() => setShowSafePlace(false)} onComplete={handleTaskComplete} />}
      {introSchemaId && <SchemaIntroSheet schemaId={introSchemaId} onClose={() => setIntroSchemaId(null)} onComplete={() => { setIntroSchemaId(null); handleTaskComplete(); }} />}
      {introModeId && <ModeIntroSheet modeId={introModeId} onClose={() => setIntroModeId(null)} onComplete={() => { setIntroModeId(null); handleTaskComplete(); }} />}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => {
            setShowTaskCreate(false);
            Promise.all([api.getTasks(), api.getTaskHistory()]).then(([t, h]) => { setTasks(t); setTaskHistory(h); onTasksChanged?.(); }).catch(() => {});
          }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      {showAllTasks && (
        <BottomSheet onClose={() => setShowAllTasks(false)} zIndex={200}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, paddingTop: 4 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                Мои цели
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
                {tasks.length === 0
                  ? 'Поставь себе цель и иди к ней маленькими шагами'
                  : `${tasks.length} ${plural(tasks.length, 'активная', 'активные', 'активных')}${taskHistory.length > 0 ? ` · ${taskHistory.length} выполнено` : ''}`}
              </div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: 'rgba(251,146,60,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>🎯</div>
          </div>

          {/* Active tasks */}
          {tasks.length === 0 ? (
            <div style={{
              padding: '36px 20px', textAlign: 'center',
              background: 'transparent', borderRadius: 16,
              border: '1px dashed var(--line)', marginBottom: 16,
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✨</div>
              <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.55, maxWidth: 240, margin: '0 auto' }}>
                Пока нет активных целей. Поставь первую — большие изменения начинаются с малого.
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              {tasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={() => openTask(task)}
                  onComplete={task.done === null && task.type === 'custom'
                    ? () => api.completeTask(task.id, true)
                        .then(() => Promise.all([api.getTasks(), api.getTaskHistory()]))
                        .then(([t, h]) => { setTasks(t); setTaskHistory(h); onTasksChanged?.(); })
                        .catch(() => {})
                    : undefined}
                />
              ))}
            </div>
          )}

          {/* Completed history */}
          {taskHistory.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 20, marginBottom: 10 }}>
                Выполнено
              </div>
              <div>
                {taskHistory.map((task, i) => (
                  <div key={task.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
                    borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                    opacity: 0.6,
                  }}>
                    <span style={{ fontSize: 15, flexShrink: 0, width: 20, textAlign: 'center' }}>
                      {task.done === true ? '✅' : '❌'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.35 }}>{resolveTaskDisplayText(task)}</div>
                      {task.completedAt && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{fmtDate(new Date(task.completedAt).toISOString().slice(0, 10))}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Add button */}
          <button
            onClick={() => { setShowAllTasks(false); setShowTaskCreate(true); }}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(167,139,250,0.10))',
              outline: '1px solid rgba(167,139,250,0.28)',
              color: 'var(--accent)', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', marginTop: 18, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 17 }}>+</span> Поставить цель
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
