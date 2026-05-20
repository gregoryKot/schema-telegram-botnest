import { useEffect, useState } from 'react';
import { SchemaFlashcard } from '../components/SchemaFlashcard';
import { LetterToSelf } from '../components/LetterToSelf';
import { BeliefCheck } from '../components/BeliefCheck';
import { SafePlace } from '../components/SafePlace';
import { CHILDHOOD_DONE_KEY } from '../utils/storageKeys';
import { TaskCreateSheet, getTaskDisplayText } from '../components/TaskCreateSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { api } from '../api';
import type { UserTask, TherapyRelationInfo } from '../api';
import { BottomSheet } from '../components/BottomSheet';
import { fmtDate } from '../utils/format';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapyData';
import { NEED_ORDER, NEED_DATA } from '../needData';

const NEED_COLORS: Record<string, string> = {
  attachment: 'var(--c-plum)',
  autonomy:   'var(--c-slate)',
  expression: 'var(--c-rose)',
  play:       'var(--c-moss)',
  limits:     'var(--c-amber)',
};

interface Props {
  onOpenChildhoodWheel: () => void;
  onOpenPractices: () => void;
  onOpenPlans: () => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  onOpenSchema?: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes'; highlight?: string }) => void;
  practiceCount?: number | null;
  planCount?: number | null;
  refreshKey?: number;
  initialTasks?: UserTask[] | null;
  onTasksChanged?: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

function resolveTaskDisplayText(task: UserTask): string {
  const text = getTaskDisplayText(task.type, task.text);
  if (text === task.text) {
    const schema = ALL_SCHEMAS.find(s => s.id === task.text);
    if (schema) return `Карточка схемы: ${schema.name}`;
    const mode = ALL_MODES.find(m => m.id === task.text);
    if (mode) return `Карточка режима: ${mode.name}`;
  }
  return text;
}

// Calm document-style task row (no emoji bubbles, no rounded boxes)
function TaskLine({ task, onOpen, onComplete, fromTherapist }: { task: UserTask; onOpen: () => void; onComplete?: () => void; fromTherapist?: boolean }) {
  const isStreakTask = task.type === 'diary_streak' || task.type === 'tracker_streak';
  const [completing, setCompleting] = useState(false);
  const target = task.targetDays ?? 0;
  const progress = task.progress !== undefined ? Math.min(task.progress, target) : 0;
  return (
    <div
      onClick={task.doneToday ? undefined : onOpen}
      className="list-line"
      style={{ cursor: task.doneToday ? 'default' : 'pointer', opacity: task.doneToday ? 0.45 : 1 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {fromTherapist && !task.doneToday && (
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 4 }}>от терапевта</div>
        )}
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>
          {resolveTaskDisplayText(task)}
        </div>
        {target > 0 && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, maxWidth: 180, height: 3, background: 'rgba(var(--fg-rgb),0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${target ? (progress / target) * 100 : 0}%`, height: '100%', background: 'var(--accent)' }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>{progress}/{target}</span>
          </div>
        )}
        {task.dueDate && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>до {fmtDate(task.dueDate)}</div>}
        {task.doneToday && isStreakTask && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>сделано сегодня · завтра снова</div>
        )}
      </div>
      {!task.doneToday && task.done === null && task.type === 'custom' && onComplete ? (
        <button
          disabled={completing}
          onClick={e => { e.stopPropagation(); setCompleting(true); onComplete(); }}
          className="link"
          style={{ background: 'none', border: 'none', padding: 0, cursor: completing ? 'default' : 'pointer', opacity: completing ? 0.5 : 1, fontFamily: 'inherit' }}
        >
          {completing ? '...' : 'готово →'}
        </button>
      ) : !task.doneToday ? (
        <span className="link">открыть →</span>
      ) : (
        <span className="text-xs faint">готово</span>
      )}
    </div>
  );
}

export function HelpSection({ onOpenChildhoodWheel, onOpenPractices, onOpenPlans, onOpenTracker, onOpenDiaries, onOpenSchema, practiceCount, planCount, refreshKey, initialTasks, onTasksChanged, userRole: _userRole, onOpenTherapistCabinet: _onOpenTherapistCabinet }: Props) {
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

  const therapistTasks = tasks.filter(t => t.assignedBy !== null && !t.doneToday);
  const myGoals = tasks.filter(t => t.assignedBy === null && !t.doneToday);

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

  // Session banner data
  const sessionBanner = (() => {
    if (relation?.role !== 'client' || !relation.nextSession) return null;
    const [datePart, timePart] = relation.nextSession.includes('T') ? relation.nextSession.split('T') : [relation.nextSession, null];
    const [y, m, d] = datePart.split('-').map(Number);
    const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const date = new Date(y, m - 1, d);
    const label = `${DAYS[date.getDay()]}, ${d} ${MONTHS[m - 1]}${timePart ? ` · ${timePart}` : ''}`;
    const isToday = datePart === new Date().toISOString().slice(0, 10);
    return { label, isToday, partnerName: relation.partnerName };
  })();

  return (
    <div className="page-inner-wide">

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <h1 className="text-3xl">Помощь</h1>
        <div className="text-md muted" style={{ marginTop: 8, maxWidth: 560, lineHeight: 1.6 }}>
          Каталог техник, упражнений и материалов по схема-терапии.
        </div>
        {sessionBanner && (
          <div className="text-sm" style={{ marginTop: 14, color: sessionBanner.isToday ? 'var(--c-moss)' : 'var(--text-sub)' }}>
            {sessionBanner.isToday ? '● Сегодня встреча' : `Следующая встреча: ${sessionBanner.label}`}
            {sessionBanner.partnerName && <span className="muted"> · с {sessionBanner.partnerName}</span>}
          </div>
        )}
      </div>

      {/* От терапевта */}
      {therapistTasks.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h3>От терапевта</h3>
            <span className="hint">{therapistTasks.length} {plural(therapistTasks.length, 'задание', 'задания', 'заданий')}</span>
          </div>
          {therapistTasks.map(task => (
            <TaskLine key={task.id} task={task} onOpen={() => openTask(task)} fromTherapist />
          ))}
        </div>
      )}

      {/* Большие практики */}
      <div className="section">
        <div className="eyebrow" style={{ marginBottom: 24 }}>Большие практики</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          {[
            { label: 'Колесо детства', sub: 'Какие базовые потребности были или не были удовлетворены', onClick: onOpenChildhoodWheel, done: childhoodDone },
            { label: 'Тест YSQ',       sub: 'Опросник Янга, 90 вопросов, 20 шкал схем',                  onClick: () => onOpenSchema?.({ startTest: true }), done: false },
            { label: 'Карта режимов',  sub: 'Найди своего Уязвимого Ребёнка, Критика, Защитника',         onClick: () => onOpenSchema?.({ tab: 'modes' }), done: false },
          ].map(card => (
            <div
              key={card.label}
              onClick={card.onClick}
              style={{ cursor: 'pointer', padding: '24px 0', borderTop: '2px solid var(--text)' }}
            >
              <div className="text-lg">{card.label}</div>
              <div className="text-sm muted" style={{ marginTop: 10, lineHeight: 1.55, maxWidth: 280 }}>{card.sub}</div>
              <span className="link" style={{ marginTop: 18, display: 'inline-block' }}>{card.done ? 'открыть →' : 'начать →'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Практики по потребностям */}
      <div className="section">
        <div className="section-head"><h3>Практики по потребностям</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 48, rowGap: 36 }}>
          {NEED_ORDER.map(id => {
            const need = NEED_DATA[id];
            if (!need) return null;
            const color = NEED_COLORS[id] ?? 'var(--accent)';
            return (
              <div key={id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <span className="text-md" style={{ fontWeight: 600 }}>{need.name}</span>
                  <span className="text-xs faint">{need.hint}</span>
                </div>
                {need.actions.slice(0, 3).map((p, i) => (
                  <div key={i} className="list-line" style={{ padding: '10px 0' }}>
                    <span className="text-sm" style={{ flex: 1 }}>{p}</span>
                    <span className="text-xs faint">3 мин</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Безопасное место */}
      <div className="section">
        <div className="section-head"><h3>Безопасное место</h3></div>
        <div className="text-md" style={{ maxWidth: 600, lineHeight: 1.55 }}>
          Управляемая визуализация для активации Хорошего Родителя — ресурс в тревожный момент.
        </div>
        <div style={{ marginTop: 18 }}>
          <button className="btn btn-secondary" onClick={() => setShowSafePlace(true)}>▶ Открыть</button>
        </div>
      </div>

      {/* Короткие техники — calm document list */}
      <div className="section">
        <div className="section-head"><h3>Короткие техники</h3></div>
        {[
          { label: 'Мне плохо',           sub: 'Пять шагов чтобы разобраться, что происходит',  onClick: () => setShowFlashcard(true) },
          { label: 'Проверка убеждений',  sub: 'Правда ли это? Что говорит за, что против',     onClick: () => setShowBeliefCheck(true) },
          { label: 'Письмо себе',         sub: 'Письмо Уязвимому Ребёнку — от Здорового Взрослого', onClick: () => setShowLetterToSelf(true) },
        ].map(item => (
          <div key={item.label} className="list-line" style={{ cursor: 'pointer' }} onClick={item.onClick}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-md" style={{ fontWeight: 500 }}>{item.label}</div>
              <div className="text-sm muted" style={{ marginTop: 3 }}>{item.sub}</div>
            </div>
            <span className="link">открыть →</span>
          </div>
        ))}
      </div>

      {/* Каталоги */}
      <div className="section">
        <div className="section-head"><h3>Каталоги</h3></div>
        {[
          { label: 'Практики',  sub: practiceCount == null ? 'Все упражнения и техники' : practiceCount === 0 ? 'Нет практик'  : `${practiceCount} ${plural(practiceCount, 'практика', 'практики', 'практик')}`, onClick: onOpenPractices },
          { label: 'Планы',     sub: planCount    == null ? 'Планы поддержки и кризисов' : planCount    === 0 ? 'История пуста' : `${planCount} ${plural(planCount, 'план', 'плана', 'планов')}`,             onClick: onOpenPlans },
        ].map(item => (
          <div key={item.label} className="list-line" style={{ cursor: 'pointer' }} onClick={item.onClick}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-md" style={{ fontWeight: 500 }}>{item.label}</div>
              <div className="text-sm muted" style={{ marginTop: 3 }}>{item.sub}</div>
            </div>
            <span className="link">открыть →</span>
          </div>
        ))}
      </div>

      {/* Мои цели */}
      <div className="section">
        <div className="section-head">
          <h3>Мои цели</h3>
          <span className="hint">
            {myGoals.length === 0
              ? 'нет активных'
              : `${myGoals.length} ${plural(myGoals.length, 'активная', 'активные', 'активных')}${taskHistory.length > 0 ? ` · ${taskHistory.length} выполнено` : ''}`}
          </span>
        </div>
        {myGoals.length === 0 ? (
          <div className="text-sm muted" style={{ maxWidth: 480, lineHeight: 1.55 }}>
            Поставь себе цель и иди к ней маленькими шагами. Большие изменения начинаются с малого.
          </div>
        ) : (
          myGoals.slice(0, 5).map(task => (
            <TaskLine
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
          ))
        )}
        <div style={{ display: 'flex', gap: 18, marginTop: 18, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setShowTaskCreate(true)}>+ Поставить цель</button>
          {(myGoals.length > 5 || taskHistory.length > 0) && (
            <span className="link" style={{ cursor: 'pointer' }} onClick={() => setShowAllTasks(true)}>все цели и история →</span>
          )}
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
          <div style={{ paddingTop: 4 }}>
            <h3 style={{ marginBottom: 4 }}>Мои цели</h3>
            <div className="text-sm muted" style={{ marginBottom: 24 }}>
              {tasks.length === 0
                ? 'Поставь себе цель и иди к ней маленькими шагами'
                : `${tasks.length} ${plural(tasks.length, 'активная', 'активные', 'активных')}${taskHistory.length > 0 ? ` · ${taskHistory.length} выполнено` : ''}`}
            </div>

            {tasks.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {tasks.map(task => (
                  <TaskLine
                    key={task.id}
                    task={task}
                    onOpen={() => openTask(task)}
                    onComplete={task.done === null && task.type === 'custom'
                      ? () => api.completeTask(task.id, true)
                          .then(() => Promise.all([api.getTasks(), api.getTaskHistory()]))
                          .then(([t, h]) => { setTasks(t); setTaskHistory(h); onTasksChanged?.(); })
                          .catch(() => {})
                      : undefined}
                    fromTherapist={task.assignedBy !== null}
                  />
                ))}
              </div>
            )}

            {taskHistory.length > 0 && (
              <>
                <div className="eyebrow" style={{ marginTop: 24, marginBottom: 10 }}>Выполнено</div>
                {taskHistory.map(task => (
                  <div key={task.id} className="list-line" style={{ opacity: 0.55 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-sm">{resolveTaskDisplayText(task)}</div>
                      {task.completedAt && <div className="text-xs faint" style={{ marginTop: 2 }}>{fmtDate(new Date(task.completedAt).toISOString().slice(0, 10))}</div>}
                    </div>
                    <span className="text-xs faint">{task.done === true ? 'готово' : 'отменено'}</span>
                  </div>
                ))}
              </>
            )}

            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => { setShowAllTasks(false); setShowTaskCreate(true); }}>
              + Поставить цель
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
