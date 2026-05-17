import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api';
import { COLORS } from '../types';
import type { Need, DayHistory } from '../types';
import { applyTheme, getTheme } from '../utils/theme';
import { todayStr } from '../utils/format';
import { cacheTherapistContact } from '../utils/therapistContact';
import { MY_SCHEMA_IDS_KEY } from '../utils/storageKeys';
import { CHILDHOOD_DONE_KEY } from './ChildhoodWheelSheet';
import { YSQ_PROGRESS_KEY } from './YSQTestSheet';

import { TodaySection } from '../sections/TodaySection';
import { DiarySection } from '../sections/DiarySection';
import { SchemasSection } from '../sections/SchemasSection';
import { ProfileSection, DEFAULT_SECTION_KEY } from '../sections/ProfileSection';
import { HelpSection } from '../sections/HelpSection';

import { TrackerOverlay } from './TrackerOverlay';
import { HistoryView } from './HistoryView';
import { SettingsSheet } from './SettingsSheet';
import { PracticesScreen } from './PracticesScreen';
import { PlansScreen } from './PlansScreen';
import { SchemaInfoSheet } from './SchemaInfoSheet';
import { NoteSheet } from './NoteSheet';
import { Celebration } from './Celebration';
import { Loader } from './Loader';
import { ChildhoodWheelSheet, shouldShowChildhoodWheel } from './ChildhoodWheelSheet';
import { TaskCreateSheet } from './TaskCreateSheet';
import { CheckInSheet } from './CheckInSheet';
import { TherapistClientSheet } from './TherapistClientSheet';
import { FloatingPill } from './FloatingPill';
import { SchemaEntrySheet } from './diary/SchemaEntrySheet';
import { ModeEntrySheet } from './diary/ModeEntrySheet';
import { GratitudeEntrySheet } from './diary/GratitudeEntrySheet';
import { PracticesOnboarding } from './PracticesOnboarding';

import type { PracticePlan, StreakData, UserTask } from '../api';

// Apply saved theme immediately before first render
applyTheme(getTheme());

type Section = 'today' | 'diary' | 'schemas' | 'profile' | 'help';
type TrackerTab = 'today' | 'history';

const NAV_ITEMS: { id: Section; icon: string; label: string }[] = [
  { id: 'today',   icon: '🏠', label: 'Сегодня' },
  { id: 'diary',   icon: '📔', label: 'Дневник' },
  { id: 'schemas', icon: '🧩', label: 'Схемы' },
  { id: 'profile', icon: '👤', label: 'Профиль' },
  { id: 'help',    icon: '💡', label: 'Помощь' },
];

const TODAY_DATE = todayStr();
const TODAY_KEY = 'celebrated_' + TODAY_DATE;
const YESTERDAY_DATE = (() => {
  const [y, m, d] = TODAY_DATE.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
})();

function formatHeaderDate(): string {
  const now = new Date();
  const dow = now.toLocaleDateString('ru-RU', { weekday: 'short' });
  const date = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${dow}, ${date}`;
}

function fillHistoryGaps(h: DayHistory[]): DayHistory[] {
  if (h.length === 0) return h;
  const byDate = new Map(h.map(d => [d.date, d]));
  const todayEntry = h.find(d => d.date === TODAY_DATE);
  const nonToday = h.filter(d => d.date !== TODAY_DATE);
  if (nonToday.length === 0) return h;
  const earliest = nonToday[nonToday.length - 1].date;
  const filled: DayHistory[] = todayEntry ? [todayEntry] : [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 60; i++) {
    const date = cursor.toISOString().split('T')[0];
    if (date < earliest) break;
    filled.push(byDate.get(date) ?? { date, ratings: {} });
    cursor.setDate(cursor.getDate() - 1);
  }
  return filled;
}

function getInitialSection(): Section {
  const stored = localStorage.getItem(DEFAULT_SECTION_KEY) as Section | null;
  if (stored && ['today', 'help', 'schemas', 'profile'].includes(stored)) return stored;
  return 'today';
}

export function AppShell() {
  const { logout } = useAuth();
  const [section, setSection] = useState<Section>(getInitialSection);
  const historyDays = 30;

  // Data state
  const [needs, setNeeds] = useState<Need[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [yesterdayRatings, setYesterdayRatings] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<DayHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [userRole, setUserRole] = useState<'CLIENT' | 'THERAPIST'>('CLIENT');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [childhoodRatings, setChildhoodRatings] = useState<Record<string, number>>({});
  const [pendingPlans, setPendingPlans] = useState<PracticePlan[]>([]);
  const [helpPracticeCount, setHelpPracticeCount] = useState<number | null>(null);
  const [helpPlanCount, setHelpPlanCount] = useState<number | null>(null);
  const [helpTasks, setHelpTasks] = useState<UserTask[] | null>(null);
  const [helpTasksKey, setHelpTasksKey] = useState(0);
  const [diaryActiveSchemaIds, setDiaryActiveSchemaIds] = useState<string[] | undefined>(undefined);
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const [childhoodWheelPending, setChildhoodWheelPending] = useState(false);
  const [todayRefreshKey, setTodayRefreshKey] = useState(0);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);

  // Overlay state
  const [showSettings, setShowSettings] = useState(false);
  const [showPractices, setShowPractices] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [showSchemaInfo, setShowSchemaInfo] = useState(false);
  const [schemaAutoStartTest, setSchemaAutoStartTest] = useState(false);
  const [schemaInitialTab, setSchemaInitialTab] = useState<'needs'|'schemas'|'modes'>('needs');
  const [schemaHighlight, setSchemaHighlight] = useState<string | undefined>();
  const [showTracker, setShowTracker] = useState(false);
  const [showTrackerOverlay, setShowTrackerOverlay] = useState(false);
  const [trackerNeedId, setTrackerNeedId] = useState<string | null>(null);
  const [trackerTab, setTrackerTab] = useState<TrackerTab>('today');
  const [showTrackerGoal, setShowTrackerGoal] = useState(false);
  const [showDiaries, setShowDiaries] = useState(false);
  const [showChildhoodWheel, setShowChildhoodWheel] = useState(false);
  const [showTodayNote, setShowTodayNote] = useState(false);
  const [backfillDate, setBackfillDate] = useState<string | null>(null);
  const [newDiaryEntry, setNewDiaryEntry] = useState<'schema' | 'mode' | 'gratitude' | null>(null);
  const [showPracticesOnboarding, setShowPracticesOnboarding] = useState(false);

  // Therapist mode
  const [therapistMode, setTherapistMode] = useState(() => localStorage.getItem('therapist_mode') === '1');
  const [cabinetView, setCabinetView] = useState<'list' | 'client'>('list');
  const therapistBackHandlerRef = useRef<() => void>(() => setCabinetView('list'));
  const switchTherapistMode = (on: boolean) => { localStorage.setItem('therapist_mode', on ? '1' : '0'); setTherapistMode(on); };


  // Online/offline
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => { window.removeEventListener('offline', handleOffline); window.removeEventListener('online', handleOnline); };
  }, []);

  // Initial data load
  useEffect(() => {
    if (!sessionStorage.getItem('init_done')) {
      const tzOffset = Math.round(-new Date().getTimezoneOffset() / 60);
      api.init(tzOffset).then(() => sessionStorage.setItem('init_done', '1')).catch(() => {});
    }
    api.recordActivity().catch(() => {});
    const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];
    Promise.all(NEED_IDS.map(id => api.getPractices(id)))
      .then(r => setHelpPracticeCount(r.reduce((s, a) => s + a.length, 0))).catch(() => setHelpPracticeCount(0));
    api.getPlanHistory(30).then(p => setHelpPlanCount(p.length)).catch(() => setHelpPlanCount(0));
    Promise.all([api.needs(), api.ratings(), api.ratings(YESTERDAY_DATE)])
      .then(([n, r, yR]) => {
        setNeeds(n);
        setRatings(r);
        setYesterdayRatings(yR);
        const initialSaved: Record<string, boolean> = {};
        for (const key of Object.keys(r)) initialSaved[key] = true;
        setSaved(initialSaved);
        if (n.length > 0 && n.every((need: Need) => r[need.id] !== undefined)) {
          localStorage.setItem(TODAY_KEY, '1');
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    api.getPendingPlans().then(setPendingPlans).catch(() => {});
    api.getChildhoodRatings().then(r => {
      if (Object.keys(r).length > 0) {
        setChildhoodRatings(r);
        localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
      }
    }).catch(() => {});
    Promise.all([api.getYsqProgress(), api.getYsqResult()]).then(([prog, result]) => {
      if (prog?.answers && !result?.answers) {
        localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ answers: prog.answers, page: prog.page }));
      }
    }).catch(() => {});
    api.getProfile().then(p => {
      setDiaryActiveSchemaIds(p.ysq.activeSchemaIds);
      setUserRole(p.role);
      if (p.role === 'THERAPIST' && localStorage.getItem('therapist_mode') === null) {
        switchTherapistMode(true);
      }
      if (p.role !== 'THERAPIST') switchTherapistMode(false);
      if (p.name) setDisplayName(p.name);
      if (p.mySchemaIds?.length > 0) {
        localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(p.mySchemaIds));
      }
      if (p.role === 'THERAPIST') {
        cacheTherapistContact({ role: 'THERAPIST', partnerId: null, partnerName: null, myId: null, myName: p.name });
      } else {
        api.getTherapyRelation().then(rel => {
          cacheTherapistContact({ role: 'CLIENT', partnerId: rel?.partnerId ?? null, partnerName: rel?.partnerName ?? null, myId: null, myName: null });
        }).catch(() => {});
      }
    }).catch(() => {});
    api.getTasks().then(setHelpTasks).catch(() => setHelpTasks([]));
  }, []);

  // History load when tracker history tab opens
  useEffect(() => {
    if (trackerTab === 'history') {
      setHistoryLoading(true);
      api.history(historyDays).then(h => setHistory(fillHistoryGaps(h))).finally(() => setHistoryLoading(false));
    }
  }, [trackerTab]);

  // Refresh Today after overlays close
  const prevOverlayRef = useRef(false);
  useEffect(() => {
    const anyOpen = showTrackerOverlay || showTracker || showDiaries || showSchemaInfo;
    if (!anyOpen && prevOverlayRef.current) setTodayRefreshKey(k => k + 1);
    prevOverlayRef.current = anyOpen;
  }, [showTrackerOverlay, showTracker, showDiaries, showSchemaInfo]);

  // Refresh Profile after overlays close
  const prevProfileOverlayRef = useRef(false);
  useEffect(() => {
    const anyOpen = showSettings || showPractices || showPlans || showTrackerOverlay || showTracker || showChildhoodWheel;
    if (!anyOpen && prevProfileOverlayRef.current && section === 'profile') {
      setProfileRefreshKey(k => k + 1);
    }
    prevProfileOverlayRef.current = anyOpen;
  }, [showSettings, showPractices, showPlans, showTrackerOverlay, showTracker, showChildhoodWheel, section]);

  const handleChange = useCallback((needId: string, value: number) => {
    setRatings(prev => ({ ...prev, [needId]: value }));
    setSaved(prev => ({ ...prev, [needId]: false }));
  }, []);

  const handleSaved = useCallback((needId: string, streak?: StreakData) => {
    setSaved(prev => ({ ...prev, [needId]: true }));
    if (streak && !localStorage.getItem(TODAY_KEY)) {
      localStorage.setItem(TODAY_KEY, '1');
      if (streak.currentStreak > 0) setCelebrationStreak(streak.currentStreak);
      else setShowTodayNote(true);
      if (streak.totalDays >= 5 && shouldShowChildhoodWheel()) setChildhoodWheelPending(true);
    }
  }, []);

  const anyOverlayOpen = !!(newDiaryEntry || showTrackerOverlay || showTracker || showDiaries || showSchemaInfo || showSettings || showPractices || showPlans || showChildhoodWheel || showTodayNote);

  if (loading) {
    return <Loader minHeight="100vh" />;
  }

  if (error) {
    return (
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>😔</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>Не удалось загрузить</div>
        <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>Проверь подключение и попробуй ещё раз</div>
        <button onClick={() => window.location.reload()} style={{ padding: '13px 28px', border: 'none', borderRadius: 14, background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* ── Sidebar (desktop) ──────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Brand */}
        <div style={{
          padding: '20px 16px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--border-color)',
          marginBottom: 8,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
            boxShadow: '0 4px 12px rgba(124, 114, 248, 0.3)',
          }}>🧠</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>СхемаЛаб</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 4 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item${section === item.id ? ' active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: '8px', borderTop: '1px solid var(--border-color)' }}>
          <button
            className="nav-item"
            onClick={() => logout()}
            style={{ color: 'var(--accent-red)' }}
          >
            <span className="nav-icon">🚪</span>
            Выйти
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="main-content" style={{ position: 'relative' }}>
        {isOffline && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'rgba(239,68,68,0.92)', backdropFilter: 'blur(8px)', padding: '10px 20px', textAlign: 'center', fontSize: 13, fontWeight: 500, color: '#fff' }}>
            Нет подключения — данные не сохраняются
          </div>
        )}

        {/* Therapist mode — full replacement */}
        {therapistMode && (
          <TherapistClientSheet
            view={cabinetView}
            onViewChange={setCabinetView}
            onClose={() => { switchTherapistMode(false); setCabinetView('list'); }}
            backHandlerRef={therapistBackHandlerRef}
          />
        )}

        {/* Regular sections */}
        {!therapistMode && (
          <div className="page-content animate-fade" key={section}>
            {section === 'today' && (
              <TodaySection
                needs={needs}
                ratings={ratings}
                yesterdayRatings={yesterdayRatings}
                onNavigate={setSection}
                onOpenSchema={(opts) => { setSchemaAutoStartTest(!!opts?.startTest); setSchemaInitialTab(opts?.tab ?? 'needs'); setSchemaHighlight(opts?.highlight); setShowSchemaInfo(true); }}
                onOpenAdvanced={() => setShowSettings(true)}
                onOpenTracker={() => { setTrackerNeedId(null); setShowTrackerOverlay(true); }}
                onOpenTrackerAt={(needId) => { setTrackerNeedId(needId); setShowTrackerOverlay(true); }}
                onOpenTrackerHistory={() => { setTrackerTab('history'); setShowTracker(true); }}
                onOpenDiaries={() => setShowDiaries(true)}
                onOpenChildhoodWheel={() => setShowChildhoodWheel(true)}
                refreshKey={todayRefreshKey}
                userRole={userRole}
                onOpenTherapistCabinet={() => { setCabinetView('list'); switchTherapistMode(true); }}
              />
            )}
            {section === 'diary' && (
              <DiarySection />
            )}
            {section === 'schemas' && (
              <SchemasSection
                onOpenSchema={(opts) => { setSchemaAutoStartTest(!!opts?.startTest); setSchemaInitialTab(opts?.tab ?? 'needs'); setSchemaHighlight(opts?.highlight); setShowSchemaInfo(true); }}
                childhoodRatings={childhoodRatings}
                onOpenChildhoodWheel={() => setShowChildhoodWheel(true)}
              />
            )}
            {section === 'profile' && (
              <ProfileSection
                onOpenSettings={() => setShowSettings(true)}
                onOpenTracker={() => { setTrackerNeedId(null); setShowTrackerOverlay(true); }}
                refreshKey={profileRefreshKey}
                displayName={displayName}
              />
            )}
            {section === 'help' && (
              <HelpSection
                onOpenChildhoodWheel={() => setShowChildhoodWheel(true)}
                onOpenPractices={() => setShowPractices(true)}
                onOpenPlans={() => setShowPlans(true)}
                onOpenTracker={() => { setTrackerNeedId(null); setShowTrackerOverlay(true); }}
                onOpenDiaries={() => setShowDiaries(true)}
                practiceCount={helpPracticeCount}
                planCount={helpPlanCount}
                initialTasks={helpTasks}
                refreshKey={helpTasksKey}
                onTasksChanged={() => { api.getTasks().then(setHelpTasks).catch(() => {}); setHelpTasksKey(k => k + 1); }}
                userRole={userRole}
                onOpenTherapistCabinet={() => { setCabinetView('list'); switchTherapistMode(true); }}
              />
            )}
          </div>
        )}

        {/* ── TrackerOverlay ── */}
        {showTrackerOverlay && (
          <TrackerOverlay
            needs={needs}
            ratings={ratings}
            saved={saved}
            isOffline={isOffline}
            onChange={handleChange}
            onSaved={handleSaved}
            onClose={() => { setShowTrackerOverlay(false); setTrackerNeedId(null); }}
            initialNeedId={trackerNeedId}
            onOpenNote={() => setShowTodayNote(true)}
            onOpenGoal={() => setShowTrackerGoal(true)}
            onOpenHistory={() => { setShowTrackerOverlay(false); setTrackerNeedId(null); setTrackerTab('history'); setShowTracker(true); }}
            yesterdayRatings={yesterdayRatings}
          />
        )}

        {/* ── History overlay ── */}
        {showTracker && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
            <div style={{
              position: 'sticky', top: 0, zIndex: 10,
              background: 'var(--nav-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              padding: '16px 20px 14px',
              borderBottom: '1px solid rgba(var(--fg-rgb),0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button
                  onClick={() => { setShowTracker(false); setTrackerTab('today'); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer', padding: '0 4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  ‹ Назад
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{formatHeaderDate()}</span>
                <button
                  onClick={() => { setShowTracker(false); setTrackerTab('today'); setTrackerNeedId(null); setShowTrackerOverlay(true); }}
                  style={{ background: 'color-mix(in srgb, var(--accent) 10%, var(--surface-2))', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--accent)', fontFamily: 'inherit' }}
                >
                  Оценить →
                </button>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--text)', lineHeight: 1.1 }}>
                История потребностей
              </h1>
            </div>

            {historyLoading
              ? <Loader minHeight="60vh" />
              : <HistoryView
                  needs={needs}
                  history={history}
                  currentRatings={ratings}
                  childhoodRatings={childhoodRatings}
                  onOpenSchemas={() => setShowSchemaInfo(true)}
                  onOpenChildhoodWheel={() => setShowChildhoodWheel(true)}
                  onGoToToday={() => { setShowTracker(false); setTrackerNeedId(null); setShowTrackerOverlay(true); }}
                  onBackfill={(date) => setBackfillDate(date)}
                />
            }
            <div style={{ height: 80 }} />

            {pendingPlans.length > 0 && needs.length > 0 && (() => {
              const plan = pendingPlans.find(p => p.scheduledDate < TODAY_DATE);
              if (!plan) return null;
              const need = needs.find(n => n.id === plan.needId);
              if (!need) return null;
              return (
                <CheckInSheet
                  plan={plan}
                  needEmoji={need.emoji ?? ''}
                  needLabel={need.chartLabel}
                  color={COLORS[need.id] ?? '#888'}
                  onDone={() => setPendingPlans(prev => prev.filter(p => p.id !== plan.id))}
                />
              );
            })()}

            {backfillDate && (
              <TrackerOverlay
                needs={needs} ratings={{}} saved={{}}
                onChange={() => {}} onSaved={() => {}}
                date={backfillDate}
                onClose={() => setBackfillDate(null)}
                onDone={() => {
                  setBackfillDate(null);
                  setHistoryLoading(true);
                  api.history(historyDays).then(h => setHistory(fillHistoryGaps(h))).finally(() => setHistoryLoading(false));
                }}
              />
            )}
          </div>
        )}

        {/* ── Diaries overlay ── */}
        {showDiaries && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
            <DiarySection onClose={() => setShowDiaries(false)} />
          </div>
        )}

        {/* ── Fullscreen overlays ── */}
        {showSettings && (
          <SettingsSheet
            onClose={() => setShowSettings(false)}
            userRole={userRole}
            displayName={displayName}
            onNameChanged={setDisplayName}
            onOpenTherapistCabinet={() => { setShowSettings(false); setTherapistMode(true); }}
            therapistMode={therapistMode}
            onToggleTherapistMode={() => switchTherapistMode(!therapistMode)}
          />
        )}
        {showPractices && (
          <PracticesScreen
            onClose={() => setShowPractices(false)}
            onOpenTracker={() => { setShowPractices(false); setTrackerNeedId(null); setShowTrackerOverlay(true); }}
          />
        )}
        {showPlans && (
          <PlansScreen
            onClose={() => setShowPlans(false)}
            onOpenTracker={() => { setShowPlans(false); setTrackerNeedId(null); setShowTrackerOverlay(true); }}
          />
        )}
        {showSchemaInfo && (
          <SchemaInfoSheet
            onClose={() => { setShowSchemaInfo(false); setSchemaAutoStartTest(false); setSchemaHighlight(undefined); }}
            ratings={ratings}
            autoStartTest={schemaAutoStartTest}
            initialTab={schemaInitialTab}
            highlightSchema={schemaHighlight}
          />
        )}
        {showChildhoodWheel && (
          <ChildhoodWheelSheet
            onClose={() => setShowChildhoodWheel(false)}
            onOpenSchemas={() => { setShowChildhoodWheel(false); setShowSchemaInfo(true); }}
            onSaved={(r) => setChildhoodRatings(r)}
          />
        )}
        {showTodayNote && (
          <NoteSheet date={TODAY_DATE} onClose={() => {
            setShowTodayNote(false);
            if (childhoodWheelPending) { setChildhoodWheelPending(false); setShowChildhoodWheel(true); }
          }} />
        )}
        {showTrackerGoal && (
          <TaskCreateSheet
            defaultType="tracker_streak"
            onCreated={() => setShowTrackerGoal(false)}
            onClose={() => setShowTrackerGoal(false)}
          />
        )}
        {showPracticesOnboarding && needs.length > 0 && (
          <PracticesOnboarding needs={needs} onDone={() => {
            setShowPracticesOnboarding(false);
            if (childhoodWheelPending) { setChildhoodWheelPending(false); setShowChildhoodWheel(true); }
          }} />
        )}

        {/* ── Celebration ── */}
        {celebrationStreak !== null && (
          <Celebration streak={celebrationStreak} onDone={() => { setCelebrationStreak(null); setShowTodayNote(true); }} />
        )}

        {/* ── Diary entry sheets (floating pill) ── */}
        {newDiaryEntry === 'schema' && (
          <SchemaEntrySheet
            activeSchemaIds={diaryActiveSchemaIds}
            onClose={() => setNewDiaryEntry(null)}
            onSave={async (data) => { await api.createSchemaDiary(data); }}
          />
        )}
        {newDiaryEntry === 'mode' && (
          <ModeEntrySheet
            onClose={() => setNewDiaryEntry(null)}
            onSave={async (data) => { await api.createModeDiary(data); }}
          />
        )}
        {newDiaryEntry === 'gratitude' && (
          <GratitudeEntrySheet
            onClose={() => setNewDiaryEntry(null)}
            date={TODAY_DATE}
            onSave={async (date, items) => { await api.createGratitudeDiary(date, items); }}
          />
        )}

        {/* ── Floating pill ── */}
        {!therapistMode && !anyOverlayOpen && (
          <FloatingPill
            onOpenTracker={() => { setTrackerNeedId(null); setShowTrackerOverlay(true); }}
            onOpenSchemaDiary={() => setNewDiaryEntry('schema')}
            onOpenModeDiary={() => setNewDiaryEntry('mode')}
            onOpenGratitude={() => setNewDiaryEntry('gratitude')}
          />
        )}
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────────────────────── */}
      <nav className="mobile-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`mobile-nav-item${section === item.id ? ' active' : ''}`}
            onClick={() => setSection(item.id)}
          >
            <span className="mn-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
