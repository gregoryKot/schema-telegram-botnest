import { useEffect, useState } from 'react';
import { COLORS } from '../types';
import type { Need, UserProfile } from '../types';
import { NEED_DATA } from '../needData';
import { api } from '../api';
import type { UserTask, TherapyRelationInfo } from '../api';
import type { Section } from '../components/BottomNav';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import { TaskCreateSheet, getTaskDisplayText } from '../components/TaskCreateSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { BottomSheet } from '../components/BottomSheet';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapyData';
import { fmtDate, todayStr } from '../utils/format';

export { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY };

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

function formatHeaderDate(): string {
  const now = new Date();
  const dow  = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const date = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return `${dow[0].toUpperCase()}${dow.slice(1)}, ${date}`;
}

function readLocalIds(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}

const TASK_EMOJI: Record<string, string> = {
  diary_streak: '📔', tracker_streak: '📊', belief_check: '🔍',
  letter_to_self: '✉️', safe_place: '🏡', childhood_wheel: '🌱',
  flashcard: '🆘', schema_intro: '🧩', mode_intro: '🔄', custom: '🎯',
};

function resolveTaskText(task: UserTask): string {
  const text = getTaskDisplayText(task.type, task.text);
  if (text === task.text) {
    const schema = ALL_SCHEMAS.find(s => s.id === task.text);
    if (schema) return schema.name;
    const mode = ALL_MODES.find(m => m.id === task.text);
    if (mode) return mode.name;
  }
  return text;
}

function resolveTaskEmoji(task: UserTask): string {
  if (TASK_EMOJI[task.type]) return TASK_EMOJI[task.type];
  if (ALL_SCHEMAS.some(s => s.id === task.text)) return '🧩';
  if (ALL_MODES.some(m => m.id === task.text)) return '🔄';
  return '🎯';
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div style={{ height: 40 }} />;
  const min = 0;
  const max = 10;
  const W = 240, H = 40;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - ((v - min) / (max - min)) * (H - 6) - 3,
  ]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', height: 40 }}>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

// ── SkeletonLines ─────────────────────────────────────────────────────────────

function SkeletonLines() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[70, 55, 80].map((w, i) => (
        <div key={i} style={{ height: 11, borderRadius: 6, width: `${w}%`, background: 'var(--surface-3)' }} />
      ))}
    </div>
  );
}

// ── Right panel label caps ────────────────────────────────────────────────────


// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  yesterdayRatings?: Record<string, number>;
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes'; highlight?: string }) => void;
  onOpenAdvanced: () => void;
  onOpenTracker: () => void;
  onOpenTrackerAt?: (needId: string) => void;
  onOpenTrackerHistory?: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
  refreshKey?: number;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
  onTasksChanged?: () => void;
}

// ── TodaySection ──────────────────────────────────────────────────────────────

export function TodaySection({
  needs, ratings, yesterdayRatings = {},
  onOpenSchema, onOpenAdvanced, onOpenTracker, onOpenTrackerAt, onOpenTrackerHistory,
  onOpenDiaries, onOpenChildhoodWheel,
  refreshKey, userRole, onOpenTherapistCabinet, onTasksChanged,
}: Props) {
  const [profile,        setProfile]        = useState<UserProfile | null>(null);
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() => readLocalIds(MY_SCHEMA_IDS_KEY));
  const [recentDiaries,  setRecentDiaries]  = useState<Array<{ type: string; label: string; time: string; dateStr: string }>>([]);
  const [diariesLoaded,  setDiariesLoaded]  = useState(false);
  const [showDiaryTask,  setShowDiaryTask]  = useState(false);
  const [tasks,          setTasks]          = useState<UserTask[]>([]);
  const [taskHistory,    setTaskHistory]    = useState<UserTask[]>([]);
  const [showAllTasks,   setShowAllTasks]   = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [introSchemaId,  setIntroSchemaId]  = useState<string | null>(null);
  const [introModeId,    setIntroModeId]    = useState<string | null>(null);
  const [activeTaskId,   setActiveTaskId]   = useState<number | null>(null);
  const [therapyRelation, setTherapyRelation] = useState<TherapyRelationInfo | null>(null);
  const [history14,      setHistory14]      = useState<number[]>([]);

  useEffect(() => {
    let ignore = false;
    setProfile(null);
    setDiariesLoaded(false);

    api.getProfile().then(p => {
      if (ignore) return;
      setProfile(p);
      if (p.mySchemaIds.length > 0) {
        setManualSchemaIds(p.mySchemaIds);
        localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(p.mySchemaIds));
      }
    }).catch(() => {});

    Promise.all([api.getSchemaDiary(), api.getModeDiary(), api.getGratitudeDiary()])
      .then(([schema, mode, gratitude]) => {
        if (ignore) return;
        const today = todayStr();
        const label = (iso: string) => iso.slice(0, 10) === today ? 'Сегодня' : fmtDate(iso.slice(0, 10));
        const all = [
          ...schema.slice(0, 2).map(e => ({ type: 'schema', label: e.trigger.slice(0, 50), time: e.createdAt.slice(11, 16), dateStr: label(e.createdAt), sortKey: e.createdAt })),
          ...mode.slice(0, 2).map(e => ({ type: 'mode', label: e.situation.slice(0, 50), time: e.createdAt.slice(11, 16), dateStr: label(e.createdAt), sortKey: e.createdAt })),
          ...gratitude.slice(0, 2).map(e => ({ type: 'gratitude', label: e.items[0]?.slice(0, 50) ?? 'Благодарность', time: '', dateStr: e.date === today ? 'Сегодня' : fmtDate(e.date), sortKey: e.date })),
        ];
        all.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        setRecentDiaries(all.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => { if (!ignore) setDiariesLoaded(true); });

    api.getTherapyRelation().then(r => { if (!ignore && r) setTherapyRelation(r); }).catch(() => {});

    api.history(14).then(days => {
      if (ignore) return;
      const today = todayStr();
      const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
      const vals = sorted.map(d => {
        const rs = Object.values(d.ratings) as number[];
        if (rs.length === 0) return 0;
        return rs.reduce((s, v) => s + v, 0) / rs.length;
      });
      // Add today if not already in history
      const hasToday = sorted.some(d => d.date === today);
      if (!hasToday) {
        const rs = Object.values(ratings);
        const avg = rs.length > 0 ? rs.reduce((s, v) => s + v, 0) / rs.length : 0;
        vals.push(avg);
      }
      setHistory14(vals);
    }).catch(() => {});

    return () => { ignore = true; };
  }, [refreshKey]);

  useEffect(() => {
    Promise.all([api.getTasks(), api.getTaskHistory()])
      .then(([t, h]) => { setTasks(t); setTaskHistory(h); })
      .catch(() => {});
  }, [refreshKey]);

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const id = activeTaskId;
    setActiveTaskId(null);
    api.completeTask(id, true)
      .then(() => Promise.all([api.getTasks(), api.getTaskHistory()]))
      .then(([t, h]) => { setTasks(t); setTaskHistory(h); onTasksChanged?.(); })
      .catch(() => {});
  }

  function handleTaskAction(task: UserTask) {
    if (task.type === 'schema_intro')   { setIntroSchemaId(task.text); setActiveTaskId(task.id); return; }
    if (task.type === 'mode_intro')     { setIntroModeId(task.text);   setActiveTaskId(task.id); return; }
    if (task.type === 'tracker_streak') { onOpenTracker(); return; }
    if (task.type === 'diary_streak')   { onOpenDiaries(); return; }
    if (task.type === 'childhood_wheel'){ onOpenChildhoodWheel(); return; }
    if (task.type === 'belief_check' || task.type === 'letter_to_self' || task.type === 'safe_place') { onOpenAdvanced(); return; }
  }

  const streak    = profile?.streak ?? 0;
  const firstName = profile?.name?.split(' ')[0] ?? '';
  const ratedCount = needs.filter(n => ratings[n.id] !== undefined).length;
  const allRated   = needs.length > 0 && ratedCount === needs.length;
  const avgRaw     = allRated ? needs.reduce((s, n) => s + ratings[n.id], 0) / needs.length : 0;
  const avgScore   = allRated ? avgRaw.toFixed(1) : null;
  const hasSchemas = [...new Set([...(profile?.ysq.activeSchemaIds ?? []), ...manualSchemaIds])].length > 0;

  // Week delta for index: compare last 7 days avg vs previous 7 days avg
  const weekDelta = (() => {
    if (history14.length < 8) return null;
    const recent   = history14.slice(-7).filter(v => v > 0);
    const previous = history14.slice(-14, -7).filter(v => v > 0);
    if (recent.length === 0 || previous.length === 0) return null;
    const diff = recent.reduce((s, v) => s + v, 0) / recent.length
               - previous.reduce((s, v) => s + v, 0) / previous.length;
    return diff;
  })();

  // Next session formatting
  const nextSession = therapyRelation?.nextSession;
  const nextSessionLabel = (() => {
    if (!nextSession) return null;
    const d = new Date(nextSession);
    const dow = d.toLocaleDateString('ru-RU', { weekday: 'short' });
    const date = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${dow[0].toUpperCase()}${dow.slice(1)}, ${date} · ${time}`;
  })();
  const daysToSession = (() => {
    if (!nextSession) return null;
    const diff = Math.round((new Date(nextSession).getTime() - Date.now()) / 86400000);
    if (diff === 0) return 'сегодня';
    if (diff === 1) return 'завтра';
    return `через ${diff} ${diff < 5 ? 'дня' : 'дней'}`;
  })();

  const activeTasks  = tasks.filter(t => t.done === null);
  const DIARY_COLORS: Record<string, string> = { schema: '#818cf8', mode: '#f472b6', gratitude: '#4ade80' };

  return (
    <div className="page-inner-wide">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {formatHeaderDate()}{streak > 0 ? ` · ${streak}-й день стрика` : ''}
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 40 }}>
        {greeting()}{firstName ? `, ${firstName}` : ''}
      </h1>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="doc-grid">

        {/* ── LEFT ──────────────────────────────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>

          {/* Therapist cabinet banner */}
          {userRole === 'THERAPIST' && onOpenTherapistCabinet && (
            <div onClick={onOpenTherapistCabinet}
              style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '14px 18px', marginBottom: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧑‍⚕️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Кабинет терапевта</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>Клиенты · Задания · Концептуализация</div>
              </div>
              <span style={{ fontSize: 16, color: 'var(--text-ghost)' }}>›</span>
            </div>
          )}

          {/* Onboarding */}
          <OnboardingWidget
            profile={profile}
            hasSchemas={hasSchemas}
            onOpenSchema={onOpenSchema}
            onOpenAdvanced={onOpenAdvanced}
            onOpenTracker={onOpenTracker}
            onOpenDiaries={onOpenDiaries}
            onOpenChildhoodWheel={onOpenChildhoodWheel}
          />

          {/* ── Needs section ── */}
          <div className="section">
            <div className="section-head">
              <h3>Потребности сегодня</h3>
              <button className="link" onClick={onOpenTracker}>Изменить →</button>
            </div>
            {needs.map(n => {
              const value  = ratings[n.id];
              const yest   = yesterdayRatings[n.id];
              const delta  = (value !== undefined && yest !== undefined) ? (value - yest) : null;
              const color  = COLORS[n.id] ?? 'var(--accent)';
              const filled = value !== undefined;
              return (
                <div key={n.id} style={{ borderBottom: '1px solid var(--line)' }}
                     onClick={() => onOpenTrackerAt ? onOpenTrackerAt(n.id) : onOpenTracker()}>
                  <div className="need-row" style={{ cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>
                      {NEED_DATA[n.id]?.name ?? n.chartLabel}
                    </span>
                    <div className="bar">
                      <i style={{ width: `${((value ?? 0) / 10) * 100}%`, background: color }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: filled ? 'var(--text)' : 'var(--text-ghost)' }}>
                      {filled ? value : '—'}
                      {delta !== null && delta !== 0 && (
                        <span style={{ fontSize: 10, color: delta > 0 ? 'var(--c-moss)' : 'var(--c-rose)', marginLeft: 3, fontWeight: 500 }}>
                          {delta > 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(1)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Practices section ── */}
          {(activeTasks.length > 0 || tasks.some(t => t.done !== null)) && (
            <div className="section">
              <div className="section-head">
                <h3>Практики на сегодня</h3>
                {activeTasks.length > 0 && <span className="hint">{activeTasks.length} активных</span>}
              </div>
              {tasks.slice(0, 5).map(task => {
                const emoji  = resolveTaskEmoji(task);
                const isDone = task.done === true;
                const isFail = task.done === false;
                return (
                  <div key={task.id} className="list-line">
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${isDone ? 'var(--c-moss)' : 'var(--line-strong)'}`, background: isDone ? 'color-mix(in srgb, var(--c-moss) 12%, transparent)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                      {isDone ? '✓' : isFail ? '×' : ''}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: isDone ? 'var(--text-faint)' : 'var(--text)', textDecoration: isDone ? 'line-through' : undefined, lineHeight: 1.3 }}>
                        {emoji} {resolveTaskText(task)}
                      </div>
                      {task.assignedBy !== null && (
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>от терапевта</div>
                      )}
                    </div>
                    {task.done === null && (
                      <button onClick={() => handleTaskAction(task)} className="link" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                        начать →
                      </button>
                    )}
                  </div>
                );
              })}
              {tasks.length > 5 && (
                <button onClick={() => setShowAllTasks(true)} className="link" style={{ marginTop: 10, display: 'block' }}>
                  Все задания ({tasks.length}) →
                </button>
              )}
              <button onClick={() => setShowDiaryTask(true)} style={{ marginTop: 8, fontSize: 12, color: 'var(--text-faint)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                + Поставить цель
              </button>
            </div>
          )}

          {/* ── Recent diary entries ── */}
          <div className="section">
            <div className="section-head">
              <h3>Последние записи</h3>
              <button className="link" onClick={onOpenDiaries}>Все →</button>
            </div>
            {!diariesLoaded ? (
              <SkeletonLines />
            ) : recentDiaries.length > 0 ? (
              <>
                {recentDiaries.map((entry, i) => {
                  const color = DIARY_COLORS[entry.type] ?? '#aaa';
                  return (
                    <div key={i} className="list-line" onClick={onOpenDiaries} style={{ cursor: 'pointer' }}>
                      <div style={{ width: 3, height: 28, borderRadius: 3, background: color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{entry.dateStr}{entry.time ? ` · ${entry.time}` : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.7, padding: '8px 0' }}>
                Фиксируй моменты когда схема активируется — это главная практика
              </div>
            )}
          </div>

        </div>

        {/* ── RIGHT: bare aside, no card wrappers ───────────────────────────── */}
        <aside className="doc-aside today-aside">

          {/* Index */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>Индекс сегодня</div>
          <div onClick={onOpenTrackerHistory} style={{ cursor: onOpenTrackerHistory ? 'pointer' : undefined }}>
            <div style={{ fontSize: 54, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {avgScore ?? '—'}
            </div>
            {weekDelta !== null && (
              <div style={{ fontSize: 12, color: weekDelta > 0 ? 'var(--c-moss)' : weekDelta < 0 ? 'var(--c-rose)' : 'var(--text-faint)', marginTop: 6, fontWeight: 500 }}>
                {weekDelta > 0 ? '+' : ''}{weekDelta.toFixed(1)} за неделю
              </div>
            )}
            {history14.length > 1 && (
              <div style={{ marginTop: 14 }}>
                <Sparkline values={history14} />
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{Math.min(history14.length, 14)} дней</div>
              </div>
            )}
          </div>

          <hr className="hr-soft" style={{ margin: '32px 0' }} />

          {/* Therapist block */}
          {therapyRelation?.partnerName && therapyRelation.role === 'client' && (
            <>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Терапевт</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{therapyRelation.partnerName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>Схема-терапевт</div>
              {nextSessionLabel && (
                <>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>Следующая встреча</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{nextSessionLabel}</div>
                  {daysToSession && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>{daysToSession}</div>}
                </>
              )}
              <a href={`tg://user?id=${therapyRelation.partnerId}`}
                style={{ display: 'block', padding: '7px 0', borderRadius: 7, border: '1px solid var(--line)', textAlign: 'center', fontSize: 13, fontWeight: 500, color: 'var(--text)', textDecoration: 'none', marginTop: 4 }}>
                Написать
              </a>
              <hr className="hr-soft" style={{ margin: '28px 0' }} />
            </>
          )}

          {/* Streak */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>Стрик</div>
          <div style={{ fontSize: 54, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: streak > 0 ? 'var(--c-clay)' : 'var(--text-ghost)' }}>
            {streak}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 6 }}>
            {streak === 0 ? 'Оцени потребности — начнётся стрик' : 'дней подряд'}
          </div>

        </aside>
      </div>

      {/* Overlays */}
      {showDiaryTask && <TaskCreateSheet defaultType="diary_streak" onCreated={() => setShowDiaryTask(false)} onClose={() => setShowDiaryTask(false)} />}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => { setShowTaskCreate(false); Promise.all([api.getTasks(), api.getTaskHistory()]).then(([t, h]) => { setTasks(t); setTaskHistory(h); onTasksChanged?.(); }).catch(() => {}); }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      {introSchemaId && <SchemaIntroSheet schemaId={introSchemaId} onClose={() => setIntroSchemaId(null)} onComplete={() => { setIntroSchemaId(null); handleTaskComplete(); }} />}
      {introModeId   && <ModeIntroSheet   modeId={introModeId}   onClose={() => setIntroModeId(null)}   onComplete={() => { setIntroModeId(null); handleTaskComplete(); }} />}

      {/* All tasks sheet */}
      {showAllTasks && (
        <BottomSheet onClose={() => setShowAllTasks(false)} zIndex={200}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Все задания</div>
          {tasks.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 18, flexShrink: 0, width: 22, textAlign: 'center' }}>
                {task.done === true ? '✅' : task.done === false ? '❌' : resolveTaskEmoji(task)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {task.assignedBy !== null && <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 1 }}>от терапевта</div>}
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>{resolveTaskText(task)}</div>
                {task.dueDate && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>до {fmtDate(task.dueDate)}</div>}
              </div>
              {task.done === null && task.assignedBy !== null && task.type === 'custom' && (
                <button onClick={() => api.completeTask(task.id, true).then(() => Promise.all([api.getTasks(), api.getTaskHistory()]).then(([t, h]) => { setTasks(t); setTaskHistory(h); })).catch(() => {})}
                  style={{ padding: '6px 12px', border: 'none', borderRadius: 10, background: 'color-mix(in srgb, var(--c-moss) 14%, transparent)', color: 'var(--c-moss)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  Готово
                </button>
              )}
            </div>
          ))}
          {taskHistory.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 20, marginBottom: 8 }}>Выполнено</div>
              {taskHistory.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)', opacity: 0.5 }}>
                  <span style={{ fontSize: 16, flexShrink: 0, width: 22, textAlign: 'center' }}>{task.done === true ? '✅' : '❌'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.35 }}>{resolveTaskText(task)}</div>
                    {task.completedAt && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>{fmtDate(new Date(task.completedAt).toISOString().slice(0, 10))}</div>}
                  </div>
                </div>
              ))}
            </>
          )}
          <button onClick={() => { setShowAllTasks(false); setShowTaskCreate(true); }} style={{ marginTop: 16, width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            + Поставить цель
          </button>
        </BottomSheet>
      )}
    </div>
  );
}

// ── Onboarding widget ─────────────────────────────────────────────────────────

const ONBOARDING_DONE_KEY    = 'onboarding_done';
const ONBOARDING_SKIPPED_KEY = 'onboarding_skipped';

interface StepDef {
  id: string;
  emoji: string;
  color: string;
  title: string;
  description: string;
  detail: string;
  actionLabel: string;
  isDone: (profile: UserProfile | null, ctx?: { hasSchemas: boolean }) => boolean;
}

const STEPS: StepDef[] = [
  { id: 'ysq', emoji: '🧪', color: 'var(--accent)',
    title: 'Пройди тест на схемы',
    description: 'YSQ-R — 116 вопросов, 10 минут. Узнаешь какие ранние паттерны управляют твоими реакциями.',
    detail: '20 схем · история прохождений · советы',
    actionLabel: 'Начать тест',
    isDone: (p, ctx) => !!(p?.ysq.completedAt) || !!(ctx?.hasSchemas) },
  { id: 'tracker', emoji: '📊', color: 'var(--c-slate)',
    title: 'Оцени потребности сегодня',
    description: 'Пять оценок — и ты видишь индекс дня. Через неделю паттерн начнёт проявляться в графике.',
    detail: 'Привязанность · Автономия · Выражение · Радость · Границы',
    actionLabel: 'Перейти в трекер',
    isDone: p => !!(p?.lastActivity.needsTracker) },
  { id: 'diary', emoji: '📔', color: 'var(--accent-indigo)',
    title: 'Сделай первую запись',
    description: 'Зафикси момент когда схема сработала — это главная практика схема-терапии.',
    detail: 'Дневник схем · режимов · благодарности',
    actionLabel: 'Открыть дневник',
    isDone: p => !!(p?.lastActivity.schemaDiary || p?.lastActivity.modeDiary || p?.lastActivity.gratitudeDiary) },
  { id: 'notify', emoji: '🔔', color: 'var(--c-clay)',
    title: 'Включи ежедневное напоминание',
    description: 'Без регулярности ничего не выйдет. Одно уведомление в нужное время — всё что нужно.',
    detail: 'Время · часовой пояс · серии дней',
    actionLabel: 'Настроить',
    isDone: p => !!(p?.notifications.enabled) },
  { id: 'childhood', emoji: '🌀', color: 'var(--c-moss)',
    title: 'Исследуй колесо детства',
    description: 'Оцени как удовлетворялись потребности в детстве — откуда пришли твои паттерны.',
    detail: '5 областей · связь с активными схемами',
    actionLabel: 'Открыть',
    isDone: () => !!localStorage.getItem('childhood_wheel_done') },
];

interface OnboardingProps {
  profile: UserProfile | null;
  hasSchemas: boolean;
  onOpenSchema: Props['onOpenSchema'];
  onOpenAdvanced: Props['onOpenAdvanced'];
  onOpenTracker: Props['onOpenTracker'];
  onOpenDiaries: Props['onOpenDiaries'];
  onOpenChildhoodWheel: Props['onOpenChildhoodWheel'];
}

function OnboardingWidget({ profile, hasSchemas, onOpenSchema, onOpenAdvanced, onOpenTracker, onOpenDiaries, onOpenChildhoodWheel }: OnboardingProps) {
  const [skipped, setSkipped] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(ONBOARDING_SKIPPED_KEY) ?? '[]'); } catch { return []; }
  });
  const [done,       setDone]       = useState(() => !!localStorage.getItem(ONBOARDING_DONE_KEY));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (done || profile === null) return null;

  const ctx = { hasSchemas };
  const doneCount = STEPS.filter(s => s.isDone(profile, ctx)).length;
  const allDone   = doneCount === STEPS.length;
  const autoStep  = STEPS.find(s => !s.isDone(profile, ctx) && !skipped.includes(s.id));

  if (allDone) {
    return (
      <div style={{ background: 'color-mix(in srgb, var(--c-moss) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--c-moss) 18%, transparent)', borderRadius: 16, padding: '20px', textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Все шаги пройдены</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 16 }}>
          Все инструменты изучены — теперь начинается настоящая работа.
        </div>
        <button onClick={() => { localStorage.setItem(ONBOARDING_DONE_KEY, '1'); setDone(true); }}
          style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Скрыть
        </button>
      </div>
    );
  }

  if (!autoStep) {
    const postponedCount = STEPS.filter(s => !s.isDone(profile, ctx)).length;
    return (
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ fontSize: 22 }}>📋</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{postponedCount} {postponedCount === 1 ? 'шаг отложен' : 'шага отложено'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{doneCount} из {STEPS.length} выполнено</div>
        </div>
        <button onClick={() => { setSkipped([]); localStorage.removeItem(ONBOARDING_SKIPPED_KEY); }}
          style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Продолжить
        </button>
      </div>
    );
  }

  const current          = (selectedId ? STEPS.find(s => s.id === selectedId) : null) ?? autoStep;
  const isCurrentDone    = current.isDone(profile, ctx);
  const isCurrentSkipped = skipped.includes(current.id) && !isCurrentDone;

  function handleAction() {
    switch (current.id) {
      case 'ysq':       onOpenSchema({ startTest: true }); break;
      case 'tracker':   onOpenTracker(); break;
      case 'diary':     onOpenDiaries(); break;
      case 'notify':    onOpenAdvanced(); break;
      case 'childhood': onOpenChildhoodWheel(); break;
    }
    setSelectedId(null);
  }

  function handleSkip() {
    const next = [...skipped, current.id];
    localStorage.setItem(ONBOARDING_SKIPPED_KEY, JSON.stringify(next));
    setSkipped(next);
    setSelectedId(null);
  }

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 14, letterSpacing: '0.05em' }}>
        {doneCount} из {STEPS.length} шагов выполнено
      </div>

      {/* Steps row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {STEPS.map(s => {
          const isDone = s.isDone(profile, ctx);
          const isSel  = s.id === current.id;
          return (
            <div key={s.id} onClick={() => setSelectedId(s.id)}
              style={{ flex: 1, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer',
                background: isDone ? 'color-mix(in srgb, var(--c-moss) 12%, transparent)' : isSel ? 'var(--surface-3)' : 'var(--surface-2)',
                border: `1.5px solid ${isDone ? 'color-mix(in srgb, var(--c-moss) 22%, transparent)' : isSel ? 'var(--line-strong)' : 'var(--line)'}`,
                opacity: skipped.includes(s.id) && !isDone ? 0.5 : 1 }}>
              {isDone ? '✓' : s.emoji}
            </div>
          );
        })}
      </div>

      {/* Current step */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `color-mix(in srgb, ${current.color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {isCurrentDone ? '✓' : current.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{current.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>{current.description}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{current.detail}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {!isCurrentDone && (
          <button onClick={handleSkip} style={{ padding: '8px 14px', border: 'none', borderRadius: 9, background: 'transparent', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}>
            {isCurrentSkipped ? 'Отложено' : 'Отложить'}
          </button>
        )}
        <button onClick={isCurrentDone ? () => setSelectedId(null) : handleAction}
          disabled={isCurrentSkipped && !isCurrentDone}
          style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: 9, background: isCurrentDone ? 'color-mix(in srgb, var(--c-moss) 14%, transparent)' : `color-mix(in srgb, ${current.color} 14%, transparent)`, color: isCurrentDone ? 'var(--c-moss)' : current.color, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {isCurrentDone ? 'Готово ✓' : current.actionLabel}
        </button>
      </div>
    </div>
  );
}
