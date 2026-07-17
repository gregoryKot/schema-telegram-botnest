import { useEffect, useState, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { Loader } from '../components/Loader';
import { SchemaFlashcard } from '../components/SchemaFlashcard';
import { TaskCreateSheet, getTaskDisplayText } from '../components/TaskCreateSheet';
import { GlyphArrowLeft } from '../components/exercises/ExScreen';
import { CHILDHOOD_DONE_KEY } from '../utils/storageKeys';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapyData';
import { fmtDate } from '../utils/format';
import type { UserTask, TherapyRelationInfo } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';

const BeliefCheckEx    = lazy(() => import('../components/exercises/BeliefCheckEx').then(m => ({ default: m.BeliefCheckEx })));
const SchemaEx         = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.SchemaEx })));
const ModeEx           = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));
const LetterEx         = lazy(() => import('../components/exercises/LetterEx').then(m => ({ default: m.LetterEx })));
const SafePlaceEx      = lazy(() => import('../components/exercises/SafePlaceEx').then(m => ({ default: m.SafePlaceEx })));
const ChildhoodWheelEx = lazy(() => import('../components/exercises/ChildhoodWheelEx').then(m => ({ default: m.ChildhoodWheelEx })));

type ExId = 'belief' | 'schema' | 'mode' | 'letter' | 'safe' | 'wheel';
interface ExStats { count: number; lastDone: string | null; }

const EXERCISES = [
  { id: 'belief' as ExId, num: '01', eyebrow: 'Когнитивная работа',   title: 'Проверка убеждения',       desc: 'Поставить мысль перед судом фактов.',     time: '8–12 мин', color: 'var(--c-slate)' },
  { id: 'schema' as ExId, num: '02', eyebrow: 'Знакомство',            title: 'Карточка схемы',            desc: 'Семь вопросов про одну схему: триггеры, тело, истоки, здоровый взгляд.', time: '10–15 мин', color: 'var(--c-plum)' },
  { id: 'mode'   as ExId, num: '03', eyebrow: 'Знакомство',            title: 'Карточка режима',           desc: 'Пять вопросов: когда активируется, что чувствует, что хочет.',         time: '7–10 мин', color: 'var(--c-clay)' },
  { id: 'letter' as ExId, num: '04', eyebrow: 'Эмоциональная работа', title: 'Письмо уязвимому ребёнку', desc: 'Сказать себе-маленькому то, что он должен был услышать.',               time: '15–25 мин', color: 'var(--c-amber)' },
  { id: 'safe'   as ExId, num: '05', eyebrow: 'Ресурс',                title: 'Безопасное место',          desc: 'Описать место, в которое можно мысленно возвращаться в тревогу.',      time: '5–10 мин', color: 'var(--c-moss)' },
  { id: 'wheel'  as ExId, num: '06', eyebrow: 'Истоки',                title: 'Колесо детства',            desc: 'Оценить базовые потребности в детстве. Найти связь с паттернами сегодня.', time: '8–12 мин', color: 'var(--accent-indigo)' },
];

function fmtAgo(d: string | null): string {
  if (!d) return 'пройдено';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
function fmtCount(n: number): string {
  if (n === 1) return `1 запись`;
  if (n < 5) return `${n} записи`;
  return `${n} записей`;
}
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}
function resolveText(task: UserTask) {
  const text = getTaskDisplayText(task.type, task.text);
  if (text === task.text) {
    const s = ALL_SCHEMAS.find(s => s.id === task.text); if (s) return s.name;
    const m = ALL_MODES.find(m => m.id === task.text);   if (m) return m.name;
  }
  return text;
}
function ExGlyph({ id }: { id: ExId }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (id === 'belief') return <svg viewBox="0 0 28 28" {...s}><path d="M14 4v20"/><path d="M6 7l-3 6h6l-3-6z"/><path d="M22 7l-3 6h6l-3-6z"/><path d="M5 24h18"/></svg>;
  if (id === 'schema') return <svg viewBox="0 0 28 28" {...s}><rect x="4" y="6" width="20" height="16" rx="2"/><path d="M4 12h20"/><path d="M9 18h6"/></svg>;
  if (id === 'mode')   return <svg viewBox="0 0 28 28" {...s}><circle cx="14" cy="14" r="9"/><circle cx="14" cy="14" r="4"/><path d="M14 5v3M14 20v3M5 14h3M20 14h3"/></svg>;
  if (id === 'letter') return <svg viewBox="0 0 28 28" {...s}><path d="M6 8h16v12a2 2 0 01-2 2H8a2 2 0 01-2-2V8z"/><path d="M6 8l8 7 8-7"/></svg>;
  if (id === 'safe')   return <svg viewBox="0 0 28 28" {...s}><path d="M5 13l9-7 9 7v9a1 1 0 01-1 1h-5v-7h-6v7H6a1 1 0 01-1-1v-9z"/></svg>;
  return <svg viewBox="0 0 28 28" {...s}><circle cx="14" cy="14" r="9"/><path d="M14 5v18M5 14h18M7.5 7.5l13 13M20.5 7.5l-13 13"/></svg>;
}

function AllGoalsOverlay({ tasks, taskHistory, onClose, onOpen, onAdd }: {
  tasks: UserTask[]; taskHistory: UserTask[];
  onClose: () => void; onOpen: (t: UserTask) => void; onAdd: () => void;
}) {
  const goBack = useHistorySheet(onClose);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg)', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
      <div className="ex-topbar"><button className="ex-back" onClick={goBack}><GlyphArrowLeft /> Назад</button></div>
      <div style={{ overflowY: 'auto', padding: '32px 24px 80px', maxWidth: 560, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, marginBottom: 24 }}>Все цели</h1>
        {tasks.map(t => (
          <div key={t.id} className="list-line" style={{ cursor: 'pointer' }} onClick={() => onOpen(t)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-md" style={{ fontWeight: 500 }}>{resolveText(t)}</div>
              {t.dueDate && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>до {fmtDate(t.dueDate)}</div>}
            </div>
            <span className="link">открыть →</span>
          </div>
        ))}
        {taskHistory.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginTop: 20, marginBottom: 8 }}>Выполнено</div>
            {taskHistory.map(t => (
              <div key={t.id} className="list-line" style={{ opacity: 0.5 }}>
                <div style={{ flex: 1 }}><div className="text-sm">{resolveText(t)}</div></div>
                <span className="text-xs faint">{t.done === true ? 'готово' : 'отменено'}</span>
              </div>
            ))}
          </>
        )}
        <button className="ex-btn ex-btn-primary" style={{ marginTop: 24, width: '100%' }} onClick={onAdd}>
          + Поставить цель
        </button>
      </div>
    </div>
  );
}

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
  const location = useLocation();
  const childhoodDone = !!localStorage.getItem(CHILDHOOD_DONE_KEY);

  const [openEx,         setOpenEx]         = useState<ExId | null>(null);
  const [schemaInitialId, setSchemaInitialId] = useState<string | undefined>(undefined);
  const [stats,          setStats]          = useState<Partial<Record<ExId, ExStats>>>({});
  const [showFlashcard,  setShowFlashcard]  = useState(false);
  const [_introSchemaId, _setIntroSchemaId] = useState<string | null>(null);
  const [introModeId,    setIntroModeId]    = useState<string | null>(null);
  const [activeTaskId,   setActiveTaskId]   = useState<number | null>(null);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [showAllGoals,   setShowAllGoals]   = useState(false);
  const [tasks,          setTasks]          = useState<UserTask[]>([]);
  const [taskHistory,    setTaskHistory]    = useState<UserTask[]>([]);
  const [relation,       setRelation]       = useState<TherapyRelationInfo | null | undefined>(undefined);

  // Detect openSchemaEx state from navigation
  useEffect(() => {
    const state = location.state as { openSchemaEx?: string } | null;
    if (state?.openSchemaEx) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренно: загрузка/сброс состояния при монтировании или смене зависимости (fetch-эффект); рефактор на key/data-layer — отдельная задача
      setOpenEx('schema');
      setSchemaInitialId(state.openSchemaEx);
      window.history.replaceState({}, '', '/practice');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно неполные зависимости (mount-only / стабильные ссылки); добавление рискует ре-фетч-циклами
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getTasks(), api.getTaskHistory()]).then(([t, h]) => {
      if (!ignore) { setTasks(t); setTaskHistory(h); }
    }).catch(() => {});
    api.getTherapyRelation().then(r => { if (!ignore) setRelation(r); }).catch(() => { if (!ignore) setRelation(null); });
    return () => { ignore = true; };
  }, [refreshKey]);

  useEffect(() => {
    Promise.allSettled([
      api.getBeliefChecks(), api.getSchemaNotes(), api.getModeNotes(),
      api.getLetters(), api.getSafePlace(), api.getChildhoodRatings(),
    ]).then(([beliefs, schemas, modes, letters, safe, wheel]) => {
      const upd: Partial<Record<ExId, ExStats>> = {};
      if (beliefs.status === 'fulfilled') { const b = beliefs.value; if (b.length) upd.belief = { count: b.length, lastDone: b[0]?.createdAt ?? null }; }
      if (schemas.status === 'fulfilled') { const s = schemas.value; if (s.length) { const sr = [...s].sort((a, b) => b.updatedAt > a.updatedAt ? 1 : -1); upd.schema = { count: s.length, lastDone: sr[0]?.updatedAt ?? null }; } }
      if (modes.status === 'fulfilled')   { const m = modes.value;   if (m.length) { const mr = [...m].sort((a, b) => b.updatedAt > a.updatedAt ? 1 : -1); upd.mode   = { count: m.length, lastDone: mr[0]?.updatedAt ?? null }; } }
      if (letters.status === 'fulfilled') { const l = letters.value; if (l.length) upd.letter = { count: l.length, lastDone: l[0]?.createdAt ?? null }; }
      if (safe.status === 'fulfilled' && safe.value) upd.safe = { count: 1, lastDone: safe.value.updatedAt ?? null };
      if (wheel.status === 'fulfilled' && Object.keys(wheel.value as object).length > 0) upd.wheel = { count: 1, lastDone: null };
      setStats(upd);
    });
  }, []);

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const id = activeTaskId; setActiveTaskId(null);
    api.completeTask(id, true)
      .then(() => Promise.all([api.getTasks(), api.getTaskHistory()]))
      .then(([t, h]) => { setTasks(t); setTaskHistory(h); onTasksChanged?.(); })
      .catch(() => {});
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
    const d = new Date(relation.nextSession);
    const label = d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
    const isToday = relation.nextSession.slice(0, 10) === new Date().toISOString().slice(0, 10);
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
      </Suspense>
    );
  }
  if (introModeId) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
      <Suspense fallback={null}><ModeEx onBack={() => setIntroModeId(null)} initialModeId={introModeId} onComplete={() => { setIntroModeId(null); handleTaskComplete(); }} /></Suspense>
    </div>
  );

  const therapistTasks = tasks.filter(t => t.assignedBy !== null && !t.doneToday);
  const myGoals        = tasks.filter(t => t.assignedBy === null  && !t.doneToday);

  return (
    <div className="page-inner-wide">

      {/* Header */}
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        <span style={{ color: 'var(--accent)' }}>● </span>Практика
      </div>
      <h1 className="hub-title" style={{ marginBottom: 8 }}>
        Упражнения<br /><span className="it">и задания</span>
      </h1>
      <p className="hub-sub" style={{ marginBottom: sessionBanner ? 12 : 40 }}>
        Шесть практик схема-терапии плюс ваши персональные цели.
      </p>
      {sessionBanner && (
        <div className="text-sm" style={{ marginBottom: 40, color: sessionBanner.isToday ? 'var(--c-moss)' : 'var(--text-sub)' }}>
          {sessionBanner.isToday ? '● Сегодня встреча' : `Следующая встреча: ${sessionBanner.label}`}
          {sessionBanner.partnerName && <span style={{ color: 'var(--text-faint)' }}> · с {sessionBanner.partnerName}</span>}
        </div>
      )}

      {/* Tasks from therapist */}
      {therapistTasks.length > 0 && (
        <div className="section">
          <div className="section-head">
            <h3>От терапевта</h3>
            <span className="hint">{therapistTasks.length} {plural(therapistTasks.length, 'задание', 'задания', 'заданий')}</span>
          </div>
          {therapistTasks.map(task => (
            <div key={task.id} className="list-line" style={{ cursor: 'pointer' }} onClick={() => openTask(task)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 4 }}>от терапевта</div>
                <div className="text-md" style={{ fontWeight: 500 }}>{resolveText(task)}</div>
                {task.dueDate && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>до {fmtDate(task.dueDate)}</div>}
              </div>
              <span className="link">начать →</span>
            </div>
          ))}
        </div>
      )}

      {/* Exercise library */}
      <div className="section">
        <div className="eyebrow" style={{ marginBottom: 20 }}>Библиотека · 6 упражнений</div>
        <div className="ex-grid">
          {EXERCISES.map(ex => {
            const s = stats[ex.id];
            return (
              <div key={ex.id} className="ex-card" onClick={() => { setSchemaInitialId(undefined); setOpenEx(ex.id); }}>
                <div className="ex-card-glyph" style={{ color: ex.color }}><ExGlyph id={ex.id} /></div>
                <div className="ex-card-body">
                  <div className="ex-card-eyebrow" style={{ color: ex.color }}>№ {ex.num} · {ex.eyebrow}</div>
                  <h3 className="ex-card-title">{ex.title}</h3>
                  <p className="ex-card-desc">{ex.desc}</p>
                  <div className="ex-card-meta">
                    <span>{ex.time}</span><span>·</span>
                    {s ? (
                      <span className="done">
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--c-moss)', display: 'inline-block' }} />
                        {fmtCount(s.count)} · {fmtAgo(s.lastDone)}
                      </span>
                    ) : <span>не начато</span>}
                  </div>
                </div>
                <span className="ex-card-cta">›</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Crisis / quick tools */}
      <div className="section">
        <div className="section-head"><h3>В трудный момент</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 32 }}>
          {[
            { label: 'Мне плохо',       sub: 'Пять шагов: разобраться что происходит, успокоиться', color: 'var(--c-rose)',  onClick: () => setShowFlashcard(true) },
            { label: 'Тест на схемы',   sub: '116 вопросов, 20 шкал схем – узнай свои паттерны',   color: 'var(--accent)',  onClick: () => onOpenSchema?.({ startTest: true }) },
            { label: 'Карта режимов',   sub: 'Найди Уязвимого Ребёнка, Критика, Защитника',         color: 'var(--c-slate)', onClick: () => onOpenSchema?.({ tab: 'modes' }) },
            { label: 'Колесо детства',  sub: 'Как удовлетворялись потребности в детстве',           color: 'var(--accent-indigo)', onClick: onOpenChildhoodWheel, done: childhoodDone },
          ].map(item => (
            <div key={item.label} onClick={item.onClick}
                 style={{ cursor: 'pointer', padding: '20px 0', borderTop: `2px solid ${item.color}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{item.label}</div>
              <div className="text-sm muted" style={{ lineHeight: 1.55 }}>{item.sub}</div>
              <span className="link" style={{ marginTop: 14, display: 'inline-block' }}>{'done' in item && item.done ? 'открыть →' : 'начать →'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* My goals */}
      <div className="section">
        <div className="section-head">
          <h3>Мои цели</h3>
          <span className="hint">{myGoals.length === 0 ? 'нет активных' : `${myGoals.length} активных`}</span>
        </div>
        {myGoals.length === 0 ? (
          <div className="text-sm muted" style={{ lineHeight: 1.55 }}>
            Поставь цель и иди к ней маленькими шагами. Большие изменения начинаются с малого.
          </div>
        ) : (
          myGoals.slice(0, 4).map(task => (
            <div key={task.id} className="list-line" style={{ cursor: 'pointer' }} onClick={() => openTask(task)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-md" style={{ fontWeight: 500 }}>{resolveText(task)}</div>
                {task.dueDate && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>до {fmtDate(task.dueDate)}</div>}
              </div>
              <span className="link">открыть →</span>
            </div>
          ))
        )}
        <div style={{ display: 'flex', gap: 18, marginTop: 16, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setShowTaskCreate(true)}>+ Поставить цель</button>
          {(myGoals.length > 4 || taskHistory.length > 0) && (
            <span className="link" style={{ cursor: 'pointer' }} onClick={() => setShowAllGoals(true)}>все цели →</span>
          )}
        </div>
      </div>

      {/* Catalogs */}
      <div className="section">
        <div className="section-head"><h3>Каталоги</h3></div>
        {[
          { label: 'Практики',  sub: 'Рекомендованные упражнения по потребностям', onClick: onOpenPractices },
          { label: 'Планы',     sub: 'Планы поддержки и кризисов',                  onClick: onOpenPlans },
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

      {/* Overlays */}
      {showFlashcard && <SchemaFlashcard onClose={() => setShowFlashcard(false)} onOpenTracker={onOpenTracker} onComplete={handleTaskComplete} />}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => { setShowTaskCreate(false); Promise.all([api.getTasks(), api.getTaskHistory()]).then(([t, h]) => { setTasks(t); setTaskHistory(h); onTasksChanged?.(); }).catch(() => {}); }}
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
