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
import { Need, UserProfile } from '../types';
import { api, UserTask } from '../api';
import { Section } from '../components/BottomNav';
import { useSafeTop } from '../utils/safezone';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { BottomSheet } from '../components/BottomSheet';
import { fmtDate, todayStr } from '../utils/format';
import { TaskRow } from '../components/tasks/TaskRow';
import { TaskHistoryList } from '../components/tasks/TaskHistoryList';
import { findLegacyTaskTarget } from '../components/tasks/taskEmoji';
import { NeedMini } from './today/NeedMini';
import { OnboardingWidget } from './today/OnboardingWidget';

export { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY };

// ── Shared helpers ────────────────────────────────────────────────────────────

function _plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10,
    m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

function formatGreetingDate(): string {
  const now = new Date();
  const dow = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const date = now.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
  return `${dow[0].toUpperCase()}${dow.slice(1)}, ${date}`;
}

function readLocalIds(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
  } catch {
    return [];
  }
}

// ── Diary type badge ──────────────────────────────────────────────────────────

function DiaryTypeBadge({ type }: { type: string }) {
  const MAP: Record<string, { label: string; color: string }> = {
    schema: { label: 'Сх', color: '#818cf8' },
    mode: { label: 'Рж', color: '#f472b6' },
    gratitude: { label: 'Бл', color: '#4ade80' },
  };
  const { label, color } = MAP[type] ?? {
    label: type.slice(0, 2),
    color: '#aaa',
  };
  return (
    <span
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        color,
        background: color + '18',
        borderRadius: '50%',
      }}
    >
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
  onOpenSchema: (opts?: {
    startTest?: boolean;
    tab?: 'needs' | 'schemas' | 'modes';
    highlight?: string;
  }) => void;
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
  needs,
  ratings,
  yesterdayRatings = {},
  onNavigate,
  onOpenSchema,
  onOpenAdvanced,
  onOpenTracker,
  onOpenTrackerAt,
  onOpenTrackerHistory,
  onOpenDiaries,
  onOpenChildhoodWheel,
  refreshKey,
  userRole,
  onOpenTherapistCabinet,
  onTasksChanged,
}: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() =>
    readLocalIds(MY_SCHEMA_IDS_KEY),
  );
  const [recentDiaries, setRecentDiaries] = useState<
    Array<{ type: string; label: string; time: string; dateStr: string }>
  >([]);
  const [diariesLoaded, setDiariesLoaded] = useState(false);
  const [showDiaryTask, setShowDiaryTask] = useState(false);
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [taskHistory, setTaskHistory] = useState<UserTask[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [introSchemaId, setIntroSchemaId] = useState<string | null>(null);
  const [introModeId, setIntroModeId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const safeTop = useSafeTop();

  const firstName =
    window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name ?? '';

  useEffect(() => {
    let ignore = false;
    setProfile(null);
    setDiariesLoaded(false);

    api
      .getProfile()
      .then((p) => {
        if (ignore) return;
        setProfile(p);
        if (p.mySchemaIds.length > 0) {
          setManualSchemaIds(p.mySchemaIds);
          localStorage.setItem(
            MY_SCHEMA_IDS_KEY,
            JSON.stringify(p.mySchemaIds),
          );
        }
      })
      .catch(() => {});

    Promise.all([
      api.getSchemaDiary(),
      api.getModeDiary(),
      api.getGratitudeDiary(),
    ])
      .then(([schema, mode, gratitude]) => {
        if (ignore) return;
        const today = todayStr();
        const dateLabel = (iso: string) =>
          iso.slice(0, 10) === today ? 'Сегодня' : fmtDate(iso.slice(0, 10));
        const all = [
          ...schema.slice(0, 2).map((e) => ({
            type: 'schema',
            label: e.trigger.slice(0, 46),
            time: e.createdAt.slice(11, 16),
            dateStr: dateLabel(e.createdAt),
            sortKey: e.createdAt,
          })),
          ...mode.slice(0, 2).map((e) => ({
            type: 'mode',
            label: e.situation.slice(0, 46),
            time: e.createdAt.slice(11, 16),
            dateStr: dateLabel(e.createdAt),
            sortKey: e.createdAt,
          })),
          ...gratitude.slice(0, 2).map((e) => ({
            type: 'gratitude',
            label: e.items[0]?.slice(0, 46) ?? 'Благодарность',
            time: '',
            dateStr: e.date === today ? 'Сегодня' : fmtDate(e.date),
            sortKey: e.date,
          })),
        ];
        all.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        setRecentDiaries(all.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setDiariesLoaded(true);
      });

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    Promise.all([api.getTasks(), api.getTaskHistory()])
      .then(([t, h]) => {
        setTasks(t);
        setTaskHistory(h);
      })
      .catch(() => {});
  }, [refreshKey]);

  function _openTask(task: UserTask) {
    if (task.assignedBy !== null && task.type !== 'custom')
      setActiveTaskId(task.id);
    switch (task.type) {
      case 'diary_streak':
        onOpenDiaries();
        break;
      case 'tracker_streak':
        onOpenTracker();
        break;
      case 'schema_intro':
        if (task.text) setIntroSchemaId(task.text);
        break;
      case 'mode_intro':
        if (task.text) setIntroModeId(task.text);
        break;
      default: {
        const legacy = findLegacyTaskTarget(task.text);
        if (legacy?.type === 'schema') {
          setIntroSchemaId(legacy.id);
          break;
        }
        if (legacy?.type === 'mode') {
          setIntroModeId(legacy.id);
          break;
        }
        // belief_check, letter_to_self etc — navigate to Help
        onNavigate('help');
      }
    }
  }

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const id = activeTaskId;
    setActiveTaskId(null);
    api
      .completeTask(id, true)
      .then(() => Promise.all([api.getTasks(), api.getTaskHistory()]))
      .then(([t, h]) => {
        setTasks(t);
        setTaskHistory(h);
        onTasksChanged?.();
      })
      .catch(() => {});
  }

  const _myTasks = tasks.filter((t) => t.assignedBy === null);
  const _therapistTasks = tasks.filter((t) => t.assignedBy !== null);
  const _hasAnyTask = tasks.length > 0;

  const streak = profile?.streak ?? 0;
  const ratedCount = needs.filter((n) => ratings[n.id] !== undefined).length;
  const allRated = needs.length > 0 && ratedCount === needs.length;
  const avgScore = allRated
    ? (needs.reduce((s, n) => s + ratings[n.id], 0) / needs.length).toFixed(1)
    : null;
  const hasSchemas =
    [...new Set([...(profile?.ysq.activeSchemaIds ?? []), ...manualSchemaIds])]
      .length > 0;

  return (
    <div
      style={{ minHeight: '100vh', paddingBottom: 120, paddingTop: safeTop }}
    >
      {/* ── Header ── */}
      <div style={{ padding: '24px 20px 0' }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            fontWeight: 500,
            marginBottom: 5,
            letterSpacing: '0.03em',
          }}
        >
          {formatGreetingDate()}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-faint)',
            fontWeight: 500,
            marginBottom: 2,
          }}
        >
          {firstName ? 'Привет,' : ''}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.5px',
              lineHeight: 1.2,
            }}
          >
            {firstName ?? 'Добро пожаловать'}
          </div>
          {/* Streak */}
          {profile !== null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
                background:
                  streak > 0 ? 'rgba(251,146,60,0.12)' : 'var(--surface)',
                border: `1px solid ${streak > 0 ? 'rgba(251,146,60,0.22)' : 'var(--border-color)'}`,
                borderRadius: 20,
                padding: '5px 10px',
              }}
            >
              {streak > 7 ? (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="#fb923c"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2C12 2 9 7 9 10.5C9 12.43 10.57 14 12.5 14C14.43 14 16 12.43 16 10.5C16 9.5 15.5 8.5 15 7.5C15 7.5 17 9 17 12C17 15.31 14.31 18 11 18C7.69 18 5 15.31 5 12C5 7 12 2 12 2Z" />
                </svg>
              ) : (
                <span style={{ fontSize: 13 }}>{streak > 0 ? '✨' : '💤'}</span>
              )}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: streak > 0 ? '#fb923c' : 'var(--text-faint)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {streak}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* ── Therapist cabinet banner ── */}
        {userRole === 'THERAPIST' && onOpenTherapistCabinet && (
          <div
            onClick={onOpenTherapistCabinet}
            className="card"
            style={{
              borderRadius: 18,
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                flexShrink: 0,
                background:
                  'color-mix(in srgb, var(--accent) 10%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              🧑‍⚕️
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: 2,
                }}
              >
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
          style={{
            padding: '18px 18px 14px',
            cursor: onOpenTrackerHistory ? 'pointer' : undefined,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-sub)',
              }}
            >
              Потребности
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {allRated ? 'Готово ✓' : `${ratedCount} / ${needs.length}`}
              </span>
              {onOpenTrackerHistory && (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-faint)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
            </div>
          </div>

          {/* 5 mini indicators */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            {needs.map((n) => (
              <NeedMini
                key={n.id}
                need={n}
                value={ratings[n.id]}
                yesterday={yesterdayRatings[n.id]}
                onTap={() =>
                  onOpenTrackerAt ? onOpenTrackerAt(n.id) : onOpenTracker()
                }
              />
            ))}
          </div>

          {/* Primary CTA */}
          {allRated && avgScore ? (
            (() => {
              const sc = parseFloat(avgScore);
              const scoreColor =
                sc >= 7
                  ? 'var(--accent-green)'
                  : sc >= 4
                    ? 'var(--accent-yellow)'
                    : 'var(--accent-red)';
              const scoreLabel =
                sc >= 7
                  ? 'Хороший день'
                  : sc >= 4
                    ? 'Средний день'
                    : 'Сложный день';
              return (
                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-faint)',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom: 2,
                      }}
                    >
                      Средний индекс
                    </div>
                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 800,
                        letterSpacing: '-1.5px',
                        color: scoreColor,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {avgScore}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: scoreColor,
                        fontWeight: 600,
                        marginTop: 2,
                      }}
                    >
                      {scoreLabel}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTrackerHistory?.();
                    }}
                    style={{
                      background:
                        'color-mix(in srgb, var(--accent) 10%, transparent)',
                      border:
                        '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span>📊</span>
                    <span>История</span>
                  </button>
                </div>
              );
            })()
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onOpenTracker();
              }}
              style={{
                borderRadius: 14,
                padding: '12px 14px',
                cursor: 'pointer',
                background:
                  'color-mix(in srgb, var(--accent) 8%, var(--surface-2))',
                border:
                  '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--accent)',
                  }}
                >
                  Оценить потребности
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-faint)',
                    marginTop: 2,
                  }}
                >
                  Займёт 2 минуты
                </div>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          )}
        </div>

        {/* ── Diary card ── */}
        <div
          onClick={onOpenDiaries}
          className="card"
          style={{
            padding: '18px 18px 14px',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-sub)',
              }}
            >
              Дневник
            </div>
            <span
              style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}
            >
              Все →
            </span>
          </div>

          {!diariesLoaded ? (
            <SkeletonLines />
          ) : recentDiaries.length > 0 ? (
            recentDiaries.map((entry, i) => {
              const typeColor =
                (
                  {
                    schema: '#818cf8',
                    mode: '#f472b6',
                    gratitude: '#4ade80',
                  } as Record<string, string>
                )[entry.type] ?? '#aaa';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 0',
                    borderTop:
                      i > 0 ? '1px solid var(--border-color)' : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      height: 36,
                      borderRadius: 4,
                      flexShrink: 0,
                      background: typeColor,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text)',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-sub)',
                        marginTop: 2,
                      }}
                    >
                      {entry.dateStr}
                      {entry.time ? ` · ${entry.time}` : ''}
                    </div>
                  </div>
                  <DiaryTypeBadge type={entry.type} />
                </div>
              );
            })
          ) : (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                lineHeight: 1.55,
              }}
            >
              Замечать моменты, когда схемы активируются — главная практика
            </div>
          )}

          <div
            style={{
              paddingTop: 10,
              marginTop: 2,
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDiaryTask(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 12,
                color: 'var(--accent)',
                cursor: 'pointer',
                fontWeight: 500,
                fontFamily: 'inherit',
              }}
            >
              + Поставить цель на дневник
            </button>
          </div>
        </div>
      </div>

      {showDiaryTask && (
        <TaskCreateSheet
          defaultType="diary_streak"
          onCreated={() => setShowDiaryTask(false)}
          onClose={() => setShowDiaryTask(false)}
        />
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

      {/* All tasks sheet */}
      {showAllTasks && (
        <BottomSheet onClose={() => setShowAllTasks(false)} zIndex={200}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 20,
            }}
          >
            Все задания
          </div>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              variant="compact"
              onComplete={() =>
                api
                  .completeTask(task.id, true)
                  .then(() =>
                    Promise.all([api.getTasks(), api.getTaskHistory()]).then(
                      ([t, h]) => {
                        setTasks(t);
                        setTaskHistory(h);
                      },
                    ),
                  )
                  .catch(() => {})
              }
            />
          ))}
          <TaskHistoryList taskHistory={taskHistory} variant="compact" />
          <button
            onClick={() => {
              setShowAllTasks(false);
              setShowTaskCreate(true);
            }}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '13px 0',
              borderRadius: 14,
              border: 'none',
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
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
        <div
          key={i}
          style={{
            height: 12,
            borderRadius: 6,
            width: `${w}%`,
            background:
              'linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)',
            backgroundSize: '200% auto',
            animation: 'shimmer 1.5s linear infinite',
          }}
        />
      ))}
    </div>
  );
}
