// TodaySection.tsx — Redesigned Today screen
// Place at: src/sections/TodaySection.tsx
// Replaces the existing TodaySection.
//
// Key differences from original:
//  – NeedMini grid with fill-bar indicators (tap opens tracker at that need)
//  – Average score card when all needs rated
//  – Diary preview with left-rail type indicator
//  – Onboarding step card with dot progress
//  – All colors via CSS tokens (light/dark theme ready)

import { useEffect, useState } from 'react';
import { Need, UserProfile, COLORS } from '../types';
import { NEED_DATA } from '../needData';
import { api, StreakData, UserTask } from '../api';
import { Section } from '../components/BottomNav';
import { useSafeTop } from '../utils/safezone';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import { TaskCreateSheet, getTaskDisplayText } from '../components/TaskCreateSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { BottomSheet } from '../components/BottomSheet';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapyData';
import { fmtDate, todayStr } from '../utils/format';

const TASK_EMOJI: Record<string, string> = {
  diary_streak: '📔', tracker_streak: '📊', belief_check: '🔍',
  letter_to_self: '✉️', safe_place: '🏡', childhood_wheel: '🌱',
  flashcard: '🆘', schema_intro: '🧩', mode_intro: '🔄', custom: '🎯',
};

function resolveTaskDisplayText(task: UserTask): string {
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

function TaskProgressBar({ task }: { task: UserTask }) {
  if (task.type === 'custom' || !task.targetDays) return null;
  const target = task.targetDays;
  const progress = task.progress !== undefined ? Math.min(task.progress, target) : 0;
  const pct = target > 0 ? (progress / target) * 100 : 0;
  return (
    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 3, background: 'rgba(var(--fg-rgb),0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>{progress}/{target}</span>
    </div>
  );
}

export { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY };

// ── Shared helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

function formatGreetingDate(): string {
  const now = new Date();
  const dow  = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const date = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return `${dow[0].toUpperCase()}${dow.slice(1)}, ${date}`;
}

function readLocalIds(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}

// ── NeedMini ──────────────────────────────────────────────────────────────────

function NeedMini({ need, value, yesterday, onTap }: {
  need: Need;
  value: number | undefined;
  yesterday?: number;
  onTap: () => void;
}) {
  const color  = COLORS[need.id] ?? '#888';
  const rgb    = hexToRgb(color);
  const filled = value !== undefined && value !== null;
  const delta  = (filled && yesterday !== undefined) ? (value! - yesterday) : null;

  return (
    <div onClick={e => { e.stopPropagation(); onTap(); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div style={{
        width: 46, height: 46, borderRadius: 14,
        position: 'relative', overflow: 'hidden',
        background: filled ? `rgba(${rgb},0.14)` : 'var(--surface)',
        border: `1.5px solid ${filled ? color + '44' : 'var(--border-color)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'border-color 0.2s',
      }}>
        {filled && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${(value! / 10) * 100}%`,
            background: `linear-gradient(to top, ${color}55, ${color}14)`,
            transition: 'height 0.4s ease',
          }}/>
        )}
        <span style={{
          position: 'relative',
          fontSize: filled ? 14 : 18, fontWeight: 700,
          color: filled ? color : 'var(--text-faint)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {filled ? value : need.emoji}
        </span>
        {/* Yesterday delta badge */}
        {delta !== null && delta !== 0 && (
          <div style={{
            position: 'absolute', top: 2, right: 2,
            fontSize: 7, fontWeight: 700, lineHeight: 1,
            color: delta > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            background: delta > 0 ? 'color-mix(in srgb, var(--accent-green) 18%, transparent)' : 'color-mix(in srgb, var(--accent-red) 18%, transparent)',
            borderRadius: 4, padding: '1px 3px',
          }}>
            {delta > 0 ? '+' : ''}{delta}
          </div>
        )}
      </div>
      <span style={{
        fontSize: 9, color: 'var(--text-faint)', fontWeight: 600,
        textAlign: 'center', letterSpacing: '0.02em', lineHeight: 1.2,
        maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {NEED_DATA[need.id]?.short ?? need.chartLabel}
      </span>
    </div>
  );
}

// ── Diary type badge ──────────────────────────────────────────────────────────

function DiaryTypeBadge({ type }: { type: string }) {
  const MAP: Record<string, { label: string; color: string }> = {
    schema:    { label: 'Сх', color: '#818cf8' },
    mode:      { label: 'Рж', color: '#f472b6' },
    gratitude: { label: 'Бл', color: '#4ade80' },
  };
  const { label, color } = MAP[type] ?? { label: type.slice(0, 2), color: '#aaa' };
  return (
    <span style={{
      width: 22, height: 22, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, color,
      background: color + '18', borderRadius: '50%',
    }}>
      {label}
    </span>
  );
}

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
  onNavigate, onOpenSchema, onOpenAdvanced, onOpenTracker, onOpenTrackerAt, onOpenTrackerHistory,
  onOpenDiaries, onOpenChildhoodWheel,
  refreshKey, userRole, onOpenTherapistCabinet, onTasksChanged,
}: Props) {
  const [profile,       setProfile]       = useState<UserProfile | null>(null);
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() => readLocalIds(MY_SCHEMA_IDS_KEY));
  const [recentDiaries, setRecentDiaries] = useState<Array<{ type: string; label: string; time: string; dateStr: string }>>([]);
  const [diariesLoaded, setDiariesLoaded] = useState(false);
  const [showDiaryTask, setShowDiaryTask] = useState(false);
  const [tasks,         setTasks]         = useState<UserTask[]>([]);
  const [taskHistory,   setTaskHistory]   = useState<UserTask[]>([]);
  const [showAllTasks,  setShowAllTasks]  = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [introSchemaId, setIntroSchemaId] = useState<string | null>(null);
  const [introModeId,   setIntroModeId]   = useState<string | null>(null);
  const [activeTaskId,  setActiveTaskId]  = useState<number | null>(null);
  const safeTop = useSafeTop();

  const firstName = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.first_name ?? '';

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
        const dateLabel = (iso: string) => iso.slice(0, 10) === today ? 'Сегодня' : fmtDate(iso.slice(0, 10));
        const all = [
          ...schema.slice(0, 2).map(e => ({ type: 'schema', label: e.trigger.slice(0, 46), time: e.createdAt.slice(11, 16), dateStr: dateLabel(e.createdAt), sortKey: e.createdAt })),
          ...mode.slice(0, 2).map(e => ({ type: 'mode', label: e.situation.slice(0, 46), time: e.createdAt.slice(11, 16), dateStr: dateLabel(e.createdAt), sortKey: e.createdAt })),
          ...gratitude.slice(0, 2).map(e => ({ type: 'gratitude', label: e.items[0]?.slice(0, 46) ?? 'Благодарность', time: '', dateStr: e.date === today ? 'Сегодня' : fmtDate(e.date), sortKey: e.date })),
        ];
        all.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        setRecentDiaries(all.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => { if (!ignore) setDiariesLoaded(true); });

    return () => { ignore = true; };
  }, [refreshKey]);

  useEffect(() => {
    Promise.all([api.getTasks(), api.getTaskHistory()])
      .then(([t, h]) => { setTasks(t); setTaskHistory(h); })
      .catch(() => {});
  }, [refreshKey]);

  function openTask(task: UserTask) {
    if (task.assignedBy !== null && task.type !== 'custom') setActiveTaskId(task.id);
    switch (task.type) {
      case 'diary_streak':    onOpenDiaries(); break;
      case 'tracker_streak':  onOpenTracker(); break;
      case 'schema_intro':    if (task.text) setIntroSchemaId(task.text); break;
      case 'mode_intro':      if (task.text) setIntroModeId(task.text); break;
      default:
        if (ALL_SCHEMAS.some(s => s.id === task.text)) { setIntroSchemaId(task.text); break; }
        if (ALL_MODES.some(m => m.id === task.text))   { setIntroModeId(task.text);   break; }
        // belief_check, letter_to_self etc — navigate to Help
        onNavigate('help');
    }
  }

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const id = activeTaskId;
    setActiveTaskId(null);
    api.completeTask(id, true)
      .then(() => Promise.all([api.getTasks(), api.getTaskHistory()]))
      .then(([t, h]) => { setTasks(t); setTaskHistory(h); onTasksChanged?.(); })
      .catch(() => {});
  }

  const myTasks        = tasks.filter(t => t.assignedBy === null);
  const therapistTasks = tasks.filter(t => t.assignedBy !== null);
  const hasAnyTask     = tasks.length > 0;

  const streak       = profile?.streak ?? 0;
  const ratedCount   = needs.filter(n => ratings[n.id] !== undefined).length;
  const allRated     = needs.length > 0 && ratedCount === needs.length;
  const avgScore     = allRated
    ? (needs.reduce((s, n) => s + ratings[n.id], 0) / needs.length).toFixed(1)
    : null;
  const hasSchemas   = [...new Set([...(profile?.ysq.activeSchemaIds ?? []), ...manualSchemaIds])].length > 0;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 120, paddingTop: safeTop }}>

      {/* ── Header ── */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500, marginBottom: 5, letterSpacing: '0.03em' }}>
          {formatGreetingDate()}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 500, marginBottom: 2 }}>
          {firstName ? 'Привет,' : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            {firstName ?? 'Добро пожаловать'}
          </div>
          {/* Streak */}
          {profile !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              background: streak > 0 ? 'rgba(251,146,60,0.12)' : 'var(--surface)',
              border: `1px solid ${streak > 0 ? 'rgba(251,146,60,0.22)' : 'var(--border-color)'}`,
              borderRadius: 20, padding: '5px 10px',
            }}>
              {streak > 7 ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#fb923c" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C12 2 9 7 9 10.5C9 12.43 10.57 14 12.5 14C14.43 14 16 12.43 16 10.5C16 9.5 15.5 8.5 15 7.5C15 7.5 17 9 17 12C17 15.31 14.31 18 11 18C7.69 18 5 15.31 5 12C5 7 12 2 12 2Z"/>
                </svg>
              ) : (
                <span style={{ fontSize: 13 }}>{streak > 0 ? '✨' : '💤'}</span>
              )}
              <span style={{ fontSize: 14, fontWeight: 700, color: streak > 0 ? '#fb923c' : 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                {streak}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Therapist cabinet banner ── */}
        {userRole === 'THERAPIST' && onOpenTherapistCabinet && (
          <div onClick={onOpenTherapistCabinet} className="card" style={{
            borderRadius: 18, padding: '12px 16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 13, flexShrink: 0,
              background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>🧑‍⚕️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                Кабинет терапевта
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                Клиенты · Задания · Концептуализация
              </div>
            </div>
            <span style={{ fontSize: 18, color: 'var(--text-faint)' }}>›</span>
          </div>
        )}

        {/* ── Onboarding widget ── */}
        <OnboardingWidget
          profile={profile}
          hasSchemas={hasSchemas}
          onOpenSchema={onOpenSchema}
          onOpenAdvanced={onOpenAdvanced}
          onOpenTracker={onOpenTracker}
          onOpenDiaries={onOpenDiaries}
          onOpenChildhoodWheel={onOpenChildhoodWheel}
        />

        {/* ── Needs card — tap card = history, tap need = tracker ── */}
        <div
          className="card"
          onClick={onOpenTrackerHistory}
          style={{ padding: '18px 18px 14px', cursor: onOpenTrackerHistory ? 'pointer' : undefined, WebkitTapHighlightColor: 'transparent' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-sub)' }}>
              Потребности
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {allRated ? 'Готово ✓' : `${ratedCount} / ${needs.length}`}
              </span>
              {onOpenTrackerHistory && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              )}
            </div>
          </div>

          {/* 5 mini indicators */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            {needs.map(n => (
              <NeedMini key={n.id} need={n} value={ratings[n.id]} yesterday={yesterdayRatings[n.id]}
                onTap={() => onOpenTrackerAt ? onOpenTrackerAt(n.id) : onOpenTracker()}
              />
            ))}
          </div>

          {/* Primary CTA */}
          {allRated && avgScore ? (() => {
            const sc = parseFloat(avgScore);
            const scoreColor = sc >= 7 ? 'var(--accent-green)' : sc >= 4 ? 'var(--accent-yellow)' : 'var(--accent-red)';
            const scoreLabel = sc >= 7 ? 'Хороший день' : sc >= 4 ? 'Средний день' : 'Сложный день';
            return (
              <div style={{
                background: 'var(--surface-2)', borderRadius: 14, padding: '12px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                    Средний индекс
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-1.5px', color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>
                    {avgScore}
                  </div>
                  <div style={{ fontSize: 11, color: scoreColor, fontWeight: 600, marginTop: 2 }}>{scoreLabel}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); onOpenTrackerHistory?.(); }} style={{
                  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                  borderRadius: 10, padding: '8px 12px', fontSize: 11, fontWeight: 600,
                  color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  <span>📊</span>
                  <span>История</span>
                </button>
              </div>
            );
          })() : (
            <div
              onClick={e => { e.stopPropagation(); onOpenTracker(); }}
              style={{
                borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                background: 'color-mix(in srgb, var(--accent) 8%, var(--surface-2))',
                border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Оценить потребности</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Займёт 2 минуты</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          )}
        </div>

        {/* ── Diary card ── */}
        <div onClick={onOpenDiaries} className="card" style={{
          padding: '18px 18px 14px', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-sub)' }}>
              Дневник
            </div>
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>Все →</span>
          </div>

          {!diariesLoaded ? (
            <SkeletonLines />
          ) : recentDiaries.length > 0 ? (
            recentDiaries.map((entry, i) => {
              const typeColor = ({ schema: '#818cf8', mode: '#f472b6', gratitude: '#4ade80' } as any)[entry.type] ?? '#aaa';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                  borderTop: i > 0 ? '1px solid var(--border-color)' : undefined,
                }}>
                  <div style={{ width: 4, height: 36, borderRadius: 4, flexShrink: 0, background: typeColor }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>
                      {entry.dateStr}{entry.time ? ` · ${entry.time}` : ''}
                    </div>
                  </div>
                  <DiaryTypeBadge type={entry.type}/>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>
              Замечать моменты, когда схемы активируются — главная практика
            </div>
          )}

          <div style={{ paddingTop: 10, marginTop: 2, borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={e => { e.stopPropagation(); setShowDiaryTask(true); }}
              style={{ background: 'none', border: 'none', padding: 0,
                fontSize: 12, color: 'var(--accent)', cursor: 'pointer',
                fontWeight: 500, fontFamily: 'inherit' }}>
              + Поставить цель на дневник
            </button>
          </div>
        </div>

      </div>

      {showDiaryTask && (
        <TaskCreateSheet defaultType="diary_streak" onCreated={() => setShowDiaryTask(false)} onClose={() => setShowDiaryTask(false)} />
      )}
      {showTaskCreate && (
        <TaskCreateSheet onCreated={() => { setShowTaskCreate(false); Promise.all([api.getTasks(), api.getTaskHistory()]).then(([t, h]) => { setTasks(t); setTaskHistory(h); onTasksChanged?.(); }).catch(() => {}); }} onClose={() => setShowTaskCreate(false)} />
      )}
      {introSchemaId && <SchemaIntroSheet schemaId={introSchemaId} onClose={() => setIntroSchemaId(null)} onComplete={() => { setIntroSchemaId(null); handleTaskComplete(); }} />}
      {introModeId   && <ModeIntroSheet   modeId={introModeId}     onClose={() => setIntroModeId(null)}   onComplete={() => { setIntroModeId(null);   handleTaskComplete(); }} />}

      {/* All tasks sheet */}
      {showAllTasks && (
        <BottomSheet onClose={() => setShowAllTasks(false)} zIndex={200}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>Все задания</div>
          {tasks.map(task => {
            const emoji = task.done === true ? '✅' : task.done === false ? '❌' : resolveTaskEmoji(task);
            return (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.05)' }}>
                <span style={{ fontSize: 18, flexShrink: 0, width: 22, textAlign: 'center' }}>{emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {task.assignedBy !== null && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 1 }}>от терапевта</div>}
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.35 }}>{resolveTaskDisplayText(task)}</div>
                  <TaskProgressBar task={task} />
                  {task.dueDate && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>до {fmtDate(task.dueDate)}</div>}
                </div>
                {task.done === null && task.assignedBy !== null && task.type === 'custom' && (
                  <button onClick={() => api.completeTask(task.id, true).then(() => Promise.all([api.getTasks(), api.getTaskHistory()]).then(([t, h]) => { setTasks(t); setTaskHistory(h); })).catch(() => {})}
                    style={{ padding: '6px 12px', border: 'none', borderRadius: 10, background: 'color-mix(in srgb, var(--accent-green) 14%, transparent)', color: 'var(--accent-green)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    Готово
                  </button>
                )}
              </div>
            );
          })}
          {taskHistory.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-faint)', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 }}>Выполнено</div>
              {taskHistory.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.04)', opacity: 0.5 }}>
                  <span style={{ fontSize: 16, flexShrink: 0, width: 22, textAlign: 'center' }}>{task.done === true ? '✅' : '❌'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.35 }}>{resolveTaskDisplayText(task)}</div>
                    {task.completedAt && <div style={{ fontSize: 10, color: 'var(--text-sub)', marginTop: 1 }}>{fmtDate(new Date(task.completedAt).toISOString().slice(0, 10))}</div>}
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonLines() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[80, 65, 90].map((w, i) => (
        <div key={i} style={{
          height: 12, borderRadius: 6, width: `${w}%`,
          background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)',
          backgroundSize: '200% auto',
          animation: 'shimmer 1.5s linear infinite',
        }}/>
      ))}
    </div>
  );
}

// ── Onboarding widget ────────────────────────────────────────────────────────

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
    title: 'Тест на схемы',
    description: 'YSQ-R — 116 вопросов, 10 минут. Покажет, какие ранние паттерны управляют реакциями.',
    detail: '20 схем · история прохождений · советы',
    actionLabel: 'Начать тест',
    isDone: (p, ctx) => !!(p?.ysq.completedAt) || !!(ctx?.hasSchemas) },
  { id: 'tracker', emoji: '📊', color: 'var(--accent-blue)',
    title: 'Оценка потребностей сегодня',
    description: 'Пять оценок — и виден индекс дня. Через неделю паттерн начнёт проявляться в графике.',
    detail: 'Привязанность · Автономия · Выражение · Радость · Границы',
    actionLabel: 'Перейти в трекер',
    isDone: p => !!(p?.lastActivity.needsTracker) },
  { id: 'diary', emoji: '📔', color: 'var(--accent-indigo)',
    title: 'Первая запись в дневнике',
    description: 'Зафиксировать момент, когда схема сработала — главная практика схема-терапии.',
    detail: 'Дневник схем · режимов · благодарности',
    actionLabel: 'Открыть дневник',
    isDone: p => !!(p?.lastActivity.schemaDiary || p?.lastActivity.modeDiary || p?.lastActivity.gratitudeDiary) },
  { id: 'notify', emoji: '🔔', color: 'var(--accent-orange)',
    title: 'Ежедневное напоминание',
    description: 'Без регулярности ничего не выйдет. Одно уведомление в нужное время — всё что нужно.',
    detail: 'Время · часовой пояс · серии дней',
    actionLabel: 'Настроить',
    isDone: p => !!(p?.notifications.enabled) },
  { id: 'childhood', emoji: '🌀', color: 'var(--accent-green)',
    title: 'Колесо детства',
    description: 'Как удовлетворялись потребности в детстве — откуда пришли нынешние паттерны.',
    detail: '5 областей · связь с активными схемами',
    actionLabel: 'Открыть',
    isDone: () => !!localStorage.getItem('childhood_wheel_done') },
];

function OnboardingWidget({ profile, hasSchemas, onOpenSchema, onOpenAdvanced, onOpenTracker, onOpenDiaries, onOpenChildhoodWheel }: {
  profile: UserProfile | null;
  hasSchemas: boolean;
  onOpenSchema: Props['onOpenSchema'];
  onOpenAdvanced: Props['onOpenAdvanced'];
  onOpenTracker: Props['onOpenTracker'];
  onOpenDiaries: Props['onOpenDiaries'];
  onOpenChildhoodWheel: Props['onOpenChildhoodWheel'];
}) {
  const [skipped, setSkipped] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(ONBOARDING_SKIPPED_KEY) ?? '[]'); } catch { return []; }
  });
  const [done, setDone] = useState(() => !!localStorage.getItem(ONBOARDING_DONE_KEY));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slideKey, setSlideKey] = useState(0);

  if (done || profile === null) return null;

  const ctx = { hasSchemas };
  const doneCount = STEPS.filter(s => s.isDone(profile, ctx)).length;
  const allDone = doneCount === STEPS.length;
  const autoStep = STEPS.find(s => !s.isDone(profile, ctx) && !skipped.includes(s.id));

  // All steps done → clean completion state
  if (allDone) {
    return (
      <div style={{ background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 18%, transparent)', borderRadius: 20, padding: '20px', textAlign: 'center' }}>
        <style>{`@keyframes obPop { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }`}</style>
        <div style={{ fontSize: 36, marginBottom: 8, animation: 'obPop 0.4s ease-out' }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Все шаги пройдены</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 16 }}>
          Все инструменты изучены — теперь начинается настоящая работа.
        </div>
        <button
          onClick={() => { localStorage.setItem(ONBOARDING_DONE_KEY, '1'); setDone(true); }}
          style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', fontFamily: 'inherit', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
        >
          Скрыть
        </button>
      </div>
    );
  }

  // All non-done steps postponed → collapsed resume state
  if (!autoStep) {
    const postponedCount = STEPS.filter(s => !s.isDone(profile, ctx)).length;
    return (
      <div style={{ background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid rgba(var(--fg-rgb),0.08)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 22 }}>📋</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
            {postponedCount} {postponedCount === 1 ? 'шаг отложен' : 'шага отложено'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{doneCount} из {STEPS.length} выполнено</div>
        </div>
        <button
          onClick={() => { setSkipped([]); localStorage.removeItem(ONBOARDING_SKIPPED_KEY); setSlideKey(k => k + 1); }}
          style={{ padding: '8px 14px', borderRadius: 10, border: 'none', fontFamily: 'inherit', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Продолжить
        </button>
      </div>
    );
  }

  const current = (selectedId ? STEPS.find(s => s.id === selectedId) : null) ?? autoStep;
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
    setSlideKey(k => k + 1);
  }

  return (
    <div style={{ background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid rgba(var(--fg-rgb),0.08)', borderRadius: 20, padding: '16px 18px', overflow: 'hidden' }}>
      <style>{`@keyframes obSlide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Progress counter */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 14, letterSpacing: '0.05em' }}>
        {doneCount} из {STEPS.length} шагов выполнено
      </div>

      {/* Current step */}
      <div key={slideKey} style={{ animation: 'obSlide 0.2s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            background: `color-mix(in srgb, ${current.color} 12%, transparent)`,
            border: `1.5px solid color-mix(in srgb, ${current.color} 24%, transparent)`,
          }}>
            {isCurrentDone ? '✓' : current.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 3 }}>
              {current.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>
              {current.detail}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 14 }}>
          {current.description}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {isCurrentDone ? (
          <div style={{
            flex: 1, padding: '11px 0', borderRadius: 12, textAlign: 'center',
            background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-green) 22%, transparent)',
            fontSize: 13, fontWeight: 600, color: 'var(--accent-green)',
          }}>
            ✓ Выполнено
          </div>
        ) : (
          <button
            onClick={handleAction}
            style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', fontFamily: 'inherit', background: current.color, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {current.actionLabel}
          </button>
        )}
        {!isCurrentDone && (
          <button
            onClick={handleSkip}
            style={{ padding: '11px 14px', borderRadius: 12, border: 'none', fontFamily: 'inherit', background: 'rgba(var(--fg-rgb),0.06)', color: isCurrentSkipped ? 'var(--accent)' : 'var(--text-faint)', fontSize: 13, cursor: 'pointer' }}
          >
            {isCurrentSkipped ? 'Вернуть' : 'Позже'}
          </button>
        )}
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {STEPS.map(s => {
          const d = s.isDone(profile, ctx);
          const sk = skipped.includes(s.id) && !d;
          const cur = s.id === current.id;
          return (
            <div key={s.id} onClick={() => { setSelectedId(s.id === current.id ? null : s.id); setSlideKey(k => k + 1); }} style={{ cursor: 'pointer' }}>
              <div style={{
                width: cur ? 20 : 8, height: 8, borderRadius: 4, transition: 'all 0.25s ease',
                background: d
                  ? 'color-mix(in srgb, var(--accent-green) 65%, transparent)'
                  : sk
                  ? 'rgba(var(--fg-rgb),0.15)'
                  : cur
                  ? `color-mix(in srgb, ${current.color} 85%, transparent)`
                  : 'rgba(var(--fg-rgb),0.12)',
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
