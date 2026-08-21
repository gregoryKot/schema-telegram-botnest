import { useEffect, useState, lazy, Suspense } from 'react';
import { COLORS } from '../types';
import type { Need, UserProfile } from '../types';
import { useNeedData } from '../needData';
import { api, reportClientError } from '../api';
import type { UserTask, TherapyRelationInfo } from '../api';
import type { Section } from '../components/appShell/navigation';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { hasDraft } from '../utils/drafts';
import { useTr } from '../utils/addressForm';
import { pressable } from '../utils/a11y';
const SchemaEx = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.SchemaEx })));
const ModeEx   = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));
import { fmtDate, todayStr } from '../utils/format';
import { greeting, formatHeaderDate, readLocalIds, resolveTaskText } from './today/helpers';
import { AllTasksOverlay } from './today/AllTasksOverlay';
import { Sparkline } from './today/Sparkline';
import { SkeletonLines } from './today/SkeletonLines';
import { OnboardingWidget } from './today/OnboardingWidget';
import { useTaskActions } from './today/useTaskActions';

export { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY };


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
  const tr = useTr();
  const NEED_DATA = useNeedData();
  const [profile,        setProfile]        = useState<UserProfile | null>(null);
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() => readLocalIds(MY_SCHEMA_IDS_KEY));
  const [recentDiaries,  setRecentDiaries]  = useState<Array<{ type: string; label: string; time: string; dateStr: string }>>([]);
  const [diariesLoaded,  setDiariesLoaded]  = useState(false);
  const [showDiaryTask,  setShowDiaryTask]  = useState(false);
  const { tasks, taskHistory, taskError, completeTask, afterCreate } = useTaskActions(refreshKey);
  const [showAllTasks,   setShowAllTasks]   = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [introSchemaId,  setIntroSchemaId]  = useState<string | null>(null);
  const [introModeId,    setIntroModeId]    = useState<string | null>(null);
  const [activeTaskId,   setActiveTaskId]   = useState<number | null>(null);
  const [therapyRelation, setTherapyRelation] = useState<TherapyRelationInfo | null>(null);
  const [history14,      setHistory14]      = useState<number[]>([]);
  // «Сейчас» фиксируется при монтировании: Date.now() в теле рендера
  // недетерминирован (react-hooks/purity). Значение — дневного масштаба.
  const [now] = useState(() => Date.now());

  // Reset to the loading state when a refresh is requested. Adjusting state
  // during render (not in an effect) keeps this off set-state-in-effect; on
  // mount profile/diariesLoaded already start null/false.
  const [seenRefresh, setSeenRefresh] = useState(refreshKey);
  if (refreshKey !== seenRefresh) {
    setSeenRefresh(refreshKey);
    setProfile(null);
    setDiariesLoaded(false);
  }

  useEffect(() => {
    let ignore = false;

    api.getProfile().then(p => {
      if (ignore) return;
      setProfile(p);
      if (p.mySchemaIds.length > 0) {
        setManualSchemaIds(p.mySchemaIds);
        localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(p.mySchemaIds));
      }
    }).catch(() => reportClientError({ message: 'today profile background load failed', section: 'today' }));

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
      .catch(() => reportClientError({ message: 'today diaries background load failed', section: 'today' }))
      .finally(() => { if (!ignore) setDiariesLoaded(true); });

    api.getTherapyRelation().then(r => { if (!ignore && r) setTherapyRelation(r); }).catch(() => reportClientError({ message: 'today therapy relation load failed', section: 'today' }));

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
    }).catch(() => reportClientError({ message: 'today history background load failed', section: 'today' }));

    return () => { ignore = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно неполные зависимости (mount-only / стабильные ссылки); добавление рискует ре-фетч-циклами
  }, [refreshKey]);

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const id = activeTaskId;
    setActiveTaskId(null);
    completeTask(id, onTasksChanged);
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
  const hasSchemas = [...new Set([...(profile?.ysq?.activeSchemaIds ?? []), ...manualSchemaIds])].length > 0;

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
    const diff = Math.round((new Date(nextSession).getTime() - now) / 86400000);
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
        <span style={{ color: 'var(--accent)' }}>● </span>
        {formatHeaderDate()}{streak > 0 ? ` · ${streak}-й стрик` : ''}
      </div>
      <h1 className="hub-title" style={{ marginBottom: 40 }}>
        {greeting().split(' ')[0]}<br />
        <span className="it">{greeting().split(' ').slice(1).join(' ')}{firstName ? `, ${firstName}` : ''}</span>
      </h1>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="doc-grid">

        {/* ── LEFT ──────────────────────────────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>

          {/* Therapist cabinet – calm link block */}
          {userRole === 'THERAPIST' && onOpenTherapistCabinet && (
            <div {...pressable(onOpenTherapistCabinet)} className="list-line" style={{ cursor: 'pointer', marginBottom: 24 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>Терапевт</div>
                <div className="text-md" style={{ fontWeight: 600 }}>Кабинет терапевта</div>
                <div className="text-sm muted" style={{ marginTop: 3 }}>Клиенты · Задания · Концептуализация</div>
              </div>
              <span className="link">открыть →</span>
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
                     {...pressable(() => onOpenTrackerAt ? onOpenTrackerAt(n.id) : onOpenTracker())}>
                  <div className="need-row" style={{ cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>
                      {NEED_DATA[n.id]?.name ?? n.chartLabel}
                    </span>
                    <div className="bar">
                      <i style={{ width: `${((value ?? 0) / 10) * 100}%`, background: color }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: filled ? 'var(--text)' : 'var(--text-ghost)' }}>
                      {filled ? value : '–'}
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
          {(activeTasks.length > 0 || tasks.some(t => t.done !== null) || taskError) && (
            <div className="section">
              <div className="section-head">
                <h3>Практики на сегодня</h3>
                {activeTasks.length > 0 && <span className="hint">{activeTasks.length} активных</span>}
              </div>
              {taskError && (
                <div role="alert" style={{ fontSize: 13, color: 'var(--c-rose)', marginBottom: 10 }}>
                  {tr(
                    'Не удалось сохранить изменение задания. Проверь соединение и попробуй ещё раз',
                    'Не удалось сохранить изменение задания. Проверьте соединение и попробуйте ещё раз',
                  )}
                </div>
              )}
              {tasks.slice(0, 5).map(task => {
                const isDone = task.done === true;
                const isFail = task.done === false;
                return (
                  <div key={task.id} className="list-line">
                    <span style={{
                      width: 14, height: 14, borderRadius: 4,
                      border: `1.5px solid ${isDone ? 'var(--text)' : 'var(--line-strong)'}`,
                      background: isDone ? 'var(--text)' : 'transparent',
                      flexShrink: 0, marginTop: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: 'var(--bg)',
                    }}>{isDone ? '✓' : isFail ? '×' : ''}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-md" style={{ fontWeight: 600, opacity: isDone ? 0.55 : 1, textDecoration: isDone ? 'line-through' : 'none' }}>
                        {resolveTaskText(task)}
                      </div>
                      {task.assignedBy !== null && !isDone && (
                        <div className="eyebrow" style={{ color: 'var(--accent)', marginTop: 4 }}>от терапевта</div>
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

          {/* ── Draft banner ── */}
          {(['schema', 'mode', 'gratitude'] as const).some(t => hasDraft(t)) && (
            <div className="section" style={{ paddingTop: 0 }}>
              <div className="section-head" style={{ marginBottom: 8 }}>
                <h3>Незаконченные записи</h3>
                <button className="link" onClick={onOpenDiaries}>открыть →</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(['schema', 'mode', 'gratitude'] as const).filter(t => hasDraft(t)).map(type => {
                  const labels = { schema: 'Дневник схем', mode: 'Дневник режимов', gratitude: 'Благодарность' };
                  const colors = { schema: 'var(--c-rose)', mode: 'var(--c-slate)', gratitude: 'var(--c-moss)' };
                  return (
                    <div key={type} {...pressable(onOpenDiaries)} className="list-line" style={{ cursor: 'pointer' }}>
                      <div style={{ width: 3, height: 28, borderRadius: 3, background: colors[type], flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors[type] }}>Черновик</div>
                        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{labels[type]}</div>
                      </div>
                      <span className="link">продолжить →</span>
                    </div>
                  );
                })}
              </div>
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
                    <div key={i} className="list-line" {...pressable(onOpenDiaries)} style={{ cursor: 'pointer' }}>
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
                Замечать моменты, когда схема активируется – главная практика
              </div>
            )}
          </div>

        </div>

        {/* ── RIGHT: bare aside, no card wrappers ───────────────────────────── */}
        <aside className="doc-aside today-aside">

          {/* Index */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>Индекс сегодня</div>
          <div {...(onOpenTrackerHistory ? pressable(onOpenTrackerHistory) : {})} style={{ cursor: onOpenTrackerHistory ? 'pointer' : undefined }}>
            <div style={{ fontSize: 54, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {avgScore ?? '–'}
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
            {streak === 0 ? tr('Оцени потребности – начнётся стрик', 'Оцените потребности – начнётся стрик') : 'дней подряд'}
          </div>

        </aside>
      </div>

      {/* Overlays */}
      {showDiaryTask && <TaskCreateSheet defaultType="diary_streak" onCreated={() => setShowDiaryTask(false)} onClose={() => setShowDiaryTask(false)} />}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => { setShowTaskCreate(false); afterCreate(onTasksChanged); }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      {introSchemaId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
          <Suspense fallback={null}><SchemaEx onBack={() => setIntroSchemaId(null)} initialSchemaId={introSchemaId} onComplete={() => { setIntroSchemaId(null); handleTaskComplete(); }} /></Suspense>
        </div>
      )}
      {introModeId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
          <Suspense fallback={null}><ModeEx onBack={() => setIntroModeId(null)} initialModeId={introModeId} onComplete={() => { setIntroModeId(null); handleTaskComplete(); }} /></Suspense>
        </div>
      )}

      {/* All tasks overlay */}
      {showAllTasks && (
        <AllTasksOverlay
          tasks={tasks}
          taskHistory={taskHistory}
          onClose={() => setShowAllTasks(false)}
          onTaskDone={id => completeTask(id)}
          onAddTask={() => { setShowAllTasks(false); setShowTaskCreate(true); }}
        />
      )}
    </div>
  );
}
