import { lazy, Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate, useParams, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api';
import type { Need, DayHistory } from '../types';
import { applyTheme, getTheme } from '../utils/theme';
import { syncMotionAttr } from '../utils/reducedMotion';
import { todayStr } from '../utils/format';
import { cacheTherapistContact } from '../utils/therapistContact';
import { MY_SCHEMA_IDS_KEY, CHILDHOOD_DONE_KEY, YSQ_PROGRESS_KEY, shouldShowChildhoodWheel } from '../utils/storageKeys';
import { CommandPalette } from './CommandPalette';
import { Loader } from './Loader';
import { ErrorBoundary } from './ErrorBoundary';

// – always-needed small helpers (no heavy data deps) –
import { NoteSheet } from './NoteSheet';
import { Celebration } from './Celebration';
import { todayInsightPhrase } from '../utils/todayInsight';
import { DonateNudge } from './DonateNudge';
import { TaskCreateSheet } from './TaskCreateSheet';

// – lazy: sections (each can pull in schemaTherapyData / needData on demand) –
const TodaySection   = lazy(() => import('../sections/TodaySection').then(m => ({ default: m.TodaySection })));
const DiarySection   = lazy(() => import('../sections/DiarySection').then(m => ({ default: m.DiarySection })));
const SchemasSection = lazy(() => import('../sections/SchemasSection').then(m => ({ default: m.SchemasSection })));
const ProfileSection = lazy(() => import('../sections/ProfileSection').then(m => ({ default: m.ProfileSection })));
const PracticeSection = lazy(() => import('../sections/PracticeSection').then(m => ({ default: m.PracticeSection })));

// – lazy: heavy overlays –
const TrackerOverlay       = lazy(() => import('./TrackerOverlay').then(m => ({ default: m.TrackerOverlay })));
const DiariesOverlay = lazy(() => import('./DiariesOverlay').then(m => ({ default: m.DiariesOverlay })));
const HistorySheet   = lazy(() => import('./HistorySheet').then(m => ({ default: m.HistorySheet })));
const SettingsSheet        = lazy(() => import('./SettingsSheet').then(m => ({ default: m.SettingsSheet })));
const PracticesScreen      = lazy(() => import('./PracticesScreen').then(m => ({ default: m.PracticesScreen })));
const PlansScreen          = lazy(() => import('./PlansScreen').then(m => ({ default: m.PlansScreen })));
const SchemaInfoSheet      = lazy(() => import('./SchemaInfoSheet').then(m => ({ default: m.SchemaInfoSheet })));
const ChildhoodWheelEx     = lazy(() => import('./exercises/ChildhoodWheelEx').then(m => ({ default: m.ChildhoodWheelEx })));
const TherapistClientSheet  = lazy(() => import('./TherapistClientSheet').then(m => ({ default: m.TherapistClientSheet })));
const TherapistTodaySection = lazy(() => import('../sections/TherapistTodaySection').then(m => ({ default: m.TherapistTodaySection })));
const PracticesOnboarding  = lazy(() => import('./PracticesOnboarding').then(m => ({ default: m.PracticesOnboarding })));
const TherapistPrivacyDisclaimer = lazy(() => import('./TherapistPrivacyDisclaimer').then(m => ({ default: m.TherapistPrivacyDisclaimer })));

const LazyLoader = () => <Loader minHeight="100dvh" />;

import type { PracticePlan, StreakData, UserTask, TherapyClientSummary } from '../api';

// Apply saved theme immediately before first render
applyTheme(getTheme());
syncMotionAttr();

type Section = 'today' | 'diary' | 'schemas' | 'profile' | 'practice';
type TrackerTab = 'today' | 'history';

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'today',    label: 'Сегодня' },
  { id: 'diary',    label: 'Дневник' },
  { id: 'schemas',  label: 'Паттерны' },
  { id: 'practice', label: 'Практика' },
  { id: 'profile',  label: 'Профиль' },
];
// Desktop sidebar omits Profile — it's accessible via the footer account link
const SIDEBAR_NAV_ITEMS = NAV_ITEMS.filter(i => i.id !== 'profile');

const SECTION_LABELS: Record<Section, string> = {
  today: 'Сегодня', diary: 'Дневник', schemas: 'Паттерны', profile: 'Профиль', practice: 'Практика',
};

function sectionFromPath(path: string): Section {
  const seg = path.split('/').filter(Boolean)[0] ?? 'today';
  if (['today','diary','schemas','profile','practice'].includes(seg)) return seg as Section;
  // Legacy redirects
  if (seg === 'help' || seg === 'exercises') return 'practice';
  return 'today';
}

const TODAY_DATE = todayStr();
const TODAY_KEY = 'celebrated_' + TODAY_DATE;
const YESTERDAY_DATE = (() => {
  const [y, m, d] = TODAY_DATE.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
})();

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

function MobileNavIcon({ id }: { id: Section }) {
  const a = { fill: 'none' as const, stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (id === 'today') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
  if (id === 'diary') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
  if (id === 'schemas') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  );
  if (id === 'practice') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

export function AppShell() {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { clientId: clientIdParam } = useParams<{ clientId?: string }>();

  // ── Section and therapist mode derived from URL ────────────────────────────
  const section: Section = useMemo(() => sectionFromPath(location.pathname), [location.pathname]);
  const setSection = useCallback((s: Section) => navigate('/' + s), [navigate]);

  const therapistMode = location.pathname.startsWith('/cabinet');
  const openClientId = clientIdParam ? parseInt(clientIdParam, 10) : null;

  // Remember last path per mode so the toggle returns user to where they were
  useEffect(() => {
    if (therapistMode) localStorage.setItem('last_cabinet_path', location.pathname);
    else if (location.pathname !== '/' && !location.pathname.startsWith('/cabinet')) {
      localStorage.setItem('last_client_path', location.pathname);
    }
  }, [location.pathname, therapistMode]);

  const switchTherapistMode = useCallback((on: boolean, persist = true) => {
    localStorage.setItem('therapist_mode', on ? '1' : '0');
    // Запоминаем стартовое предпочтение на сервере (source of truth, единое с
    // мини-аппом). Сервер принимает флаг только у THERAPIST — эндпоинт вернёт
    // 403 для клиента, поэтому просто глушим ошибку.
    if (persist) api.setTherapistView(on).catch(() => {});
    if (on) {
      const last = localStorage.getItem('last_cabinet_path');
      navigate(last && last.startsWith('/cabinet') ? last : '/cabinet');
    } else {
      const last = localStorage.getItem('last_client_path');
      navigate(last && !last.startsWith('/cabinet') && last !== '/' ? last : '/today');
    }
  }, [navigate]);

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
  const [_helpPracticeCount, setHelpPracticeCount] = useState<number | null>(null);
  const [_helpPlanCount, setHelpPlanCount] = useState<number | null>(null);
  const [_helpTasks, setHelpTasks] = useState<UserTask[] | null>(null);
  const [helpTasksKey, setHelpTasksKey] = useState(0);
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
  const [showPracticesOnboarding, setShowPracticesOnboarding] = useState(false);
  const [showTherapistDisclaimer, setShowTherapistDisclaimer] = useState(false);

  // First entry into the cabinet as a therapist → one-time privacy disclaimer
  useEffect(() => {
    if (therapistMode && userRole === 'THERAPIST'
        && !localStorage.getItem('therapist_privacy_disclaimer_seen')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренно: загрузка/сброс состояния при монтировании или смене зависимости (fetch-эффект); рефактор на key/data-layer — отдельная задача
      setShowTherapistDisclaimer(true);
    }
  }, [therapistMode, userRole]);

  // Therapist clients (for sidebar)
  const [therapistClients, setTherapistClients] = useState<TherapyClientSummary[]>([]);
  const [clientSearch, setClientSearch] = useState('');

  // Therapist cabinet navigation helpers (URL-based)
  const therapistBackHandlerRef = useRef<() => void>(() => navigate('/cabinet'));

  // Command palette
  const [cmdOpen, setCmdOpen] = useState(false);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (therapistMode) return ['Кабинет'];
    return [SECTION_LABELS[section]];
  }, [therapistMode, section]);


  // Global ⌘K + ⌘1–5 section shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen(true); return; }
      if (!therapistMode && e.metaKey) {
        const map: Record<string, Section> = { '1': 'today', '2': 'diary', '3': 'schemas', '4': 'practice' };
        if (map[e.key]) { e.preventDefault(); setSection(map[e.key] as Section); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [therapistMode, setSection]);

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
    // Mirror disclaimer acceptance to server so the Telegram mini-app can skip
    // its consent screen for users who are already active on the website.
    api.getDisclaimer().then(d => {
      if (!d.accepted) api.acceptDisclaimer().catch(() => {});
    }).catch(() => {});
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
      setUserRole(p.role);
      // Психолог по умолчанию попадает в кабинет (запрос: «если я психолог —
      // всегда начинать со странички психолога»). Уважаем явный выбор
      // клиентского режима (localStorage '0'); при заходе на дефолтный лендинг
      // (/, /today) без такого выбора — ведём в кабинет.
      if (p.role === 'THERAPIST') {
        const pref = localStorage.getItem('therapist_mode');
        const onDefaultLanding =
          location.pathname === '/' || location.pathname === '/today';
        if (pref !== '0' && !location.pathname.startsWith('/cabinet') && onDefaultLanding) {
          localStorage.setItem('therapist_mode', '1');
          navigate('/cabinet');
        } else if (pref === null) {
          localStorage.setItem('therapist_mode', '1');
        }
      }
      if (p.role !== 'THERAPIST' && location.pathname.startsWith('/cabinet')) {
        navigate('/today');
      }
      if (p.name) setDisplayName(p.name);
      if (p.mySchemaIds?.length > 0) {
        localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(p.mySchemaIds));
      }
      if (p.role === 'THERAPIST') {
        cacheTherapistContact({ role: 'THERAPIST', partnerId: null, partnerName: null, myId: null, myName: p.name });
        api.getTherapyClients().then(setTherapistClients).catch(() => {});
      } else {
        api.getTherapyRelation().then(rel => {
          cacheTherapistContact({ role: 'CLIENT', partnerId: rel?.partnerId ?? null, partnerName: rel?.partnerName ?? null, myId: null, myName: null });
        }).catch(() => {});
      }
    }).catch(() => {});
    api.getTasks().then(setHelpTasks).catch(() => setHelpTasks([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно неполные зависимости (mount-only / стабильные ссылки); добавление рискует ре-фетч-циклами
  }, []);

  // History load when tracker history tab opens
  useEffect(() => {
    if (trackerTab === 'history') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренно: загрузка/сброс состояния при монтировании или смене зависимости (fetch-эффект); рефактор на key/data-layer — отдельная задача
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

  if (loading) {
    return <Loader minHeight="100vh" />;
  }

  if (error) {
    return (
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>😔</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>Не удалось загрузить</div>
        <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>Проверь подключение и попробуй ещё раз</div>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', border: 'none', borderRadius: 8, background: 'var(--text)', color: 'var(--bg)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sb-brand">
          <div className="sb-logo">ВС</div>
          <div className="sb-name">Всё по схеме</div>
        </div>

        {userRole === 'THERAPIST' && (
          <div className="sb-mode-switch">
            <button className={`sb-mode-btn${!therapistMode ? ' is-active' : ''}`}
                    onClick={() => switchTherapistMode(false)}>Клиент</button>
            <button className={`sb-mode-btn${therapistMode ? ' is-active' : ''}`}
                    onClick={() => switchTherapistMode(true)}>Терапевт</button>
          </div>
        )}

        <nav className="sb-nav">
          {!therapistMode && SIDEBAR_NAV_ITEMS.map(item => (
            <NavLink key={item.id} to={'/' + item.id}
                     className={({ isActive }) => `sb-item${isActive ? ' is-active' : ''}`}>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {therapistMode && (<>
            <NavLink to="/cabinet/today"
                     className={({ isActive }) => `sb-item${isActive ? ' is-active' : ''}`}>
              <span>Сегодня</span>
            </NavLink>
            <NavLink to="/cabinet" end
                     className={({ isActive }) => `sb-item${isActive ? ' is-active' : ''}`}>
              <span>Все клиенты</span>
            </NavLink>
            {therapistClients.length > 0 && (
              <div className="sb-clients">
                {therapistClients.length > 4 && (
                  <div style={{ padding: '4px 12px 6px' }}>
                    <input
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Поиск клиента…"
                      style={{
                        width: '100%', padding: '5px 9px', borderRadius: 6,
                        border: '1px solid rgba(var(--fg-rgb),0.13)',
                        background: 'rgba(var(--fg-rgb),0.05)',
                        color: 'var(--text)', fontSize: 12.5, outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
                {therapistClients
                  .filter(c => {
                    if (!clientSearch.trim()) return true;
                    const name = (c.clientAlias ?? c.name ?? '').toLowerCase();
                    return name.includes(clientSearch.toLowerCase());
                  })
                  .map(c => {
                    const name = c.clientAlias ?? c.name ?? `#${c.telegramId}`;
                    const activeToday = c.todayIndex != null;
                    return (
                      <NavLink key={c.telegramId} to={`/cabinet/${c.telegramId}`}
                               className={({ isActive }) => `sb-item sb-client-item${isActive ? ' is-active' : ''}`}>
                        {activeToday && <span className="sb-active-dot" />}
                        <span className="sb-client-name">{name}</span>
                      </NavLink>
                    );
                  })}
              </div>
            )}
          </>)}
        </nav>

        <div className="sb-foot-wrap">
          {/* Today's index widget — fills the empty space and gives at-a-glance status */}
          {!therapistMode && (() => {
            const vals = Object.values(ratings);
            const allFilled = needs.length > 0 && vals.length >= needs.length;
            const idx = allFilled ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            return (
              <div className="sb-today">
                <div className="sb-today-label">Сегодня</div>
                {idx !== null ? (
                  <>
                    <div className="sb-today-index">
                      <span className="sb-today-num">{idx.toFixed(1)}</span>
                      <span className="sb-today-denom">/10</span>
                    </div>
                    <div className="sb-today-sub">индекс дня</div>
                  </>
                ) : (
                  <button className="sb-today-cta"
                          onClick={() => { setTrackerNeedId(null); setShowTrackerOverlay(true); }}>
                    Заполнить дневник →
                  </button>
                )}
              </div>
            );
          })()}
        <div className="sb-foot">
          <NavLink to="/profile" className={({ isActive }) => `sb-account${isActive ? ' is-active' : ''}`}>
            <div className="sb-avatar">{(displayName ?? '?')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sb-acc-name">{displayName || 'Профиль'}</div>
              <div className="sb-acc-role">{userRole === 'THERAPIST' ? 'Терапевт' : 'Клиент'}</div>
            </div>
          </NavLink>
          <button className="sb-item" onClick={() => setShowSettings(true)} style={{ marginTop: 2 }}>
            <span>Настройки</span>
          </button>
          <NavLink to="/account" className="sb-item" style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
            <span>Аккаунт и привязки</span>
          </NavLink>
          <button className="sb-item" onClick={() => logout()}
                  style={{ marginTop: 2, color: 'var(--c-rose)' }}>
            <span>Выйти</span>
          </button>
          <div style={{ display: 'flex', gap: 12, padding: '8px 0 0', borderTop: '1px solid var(--line)', marginTop: 4 }}>
            <a href="/privacy" target="_blank" style={{ fontSize: 11, color: 'var(--text-faint)', textDecoration: 'none' }}>Конфиденциальность</a>
            <a href="/offer" target="_blank" style={{ fontSize: 11, color: 'var(--text-faint)', textDecoration: 'none' }}>Оферта</a>
          </div>
        </div>
        </div>{/* end sb-foot-wrap */}
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className={`main${therapistMode ? ' main--cabinet' : ''}`}>
        {/* Topbar – shown in all modes */}
        <div className="topbar">
          {!therapistMode && (
            <div className="crumbs">
              {breadcrumbs.map((c, i) => (
                <span key={i}>
                  {i > 0 && <span className="sep" style={{ margin: '0 4px' }}>›</span>}
                  <span className={i === breadcrumbs.length - 1 ? 'now' : ''}>{c}</span>
                </span>
              ))}
            </div>
          )}
          <div className="t-spacer" />
          {isOffline && (
            <span style={{ fontSize: 12, color: 'var(--c-rose)', fontWeight: 500 }}>офлайн</span>
          )}
          <button className="search-pill" onClick={() => setCmdOpen(true)}>
            <span>Перейти к…</span>
            <span className="sp-spacer" />
            <span className="kbd">⌘K</span>
          </button>
        </div>

        {/* Canvas */}
        <div className="canvas">
        <Suspense fallback={<LazyLoader />}>

        {/* Therapist mode */}
        {therapistMode && location.pathname === '/cabinet/today' && (
          <ErrorBoundary section="Кабинет" key="cabinet-today-boundary">
            <TherapistTodaySection
              displayName={displayName}
              onOpenClient={(id) => navigate('/cabinet/' + id)}
            />
          </ErrorBoundary>
        )}
        {therapistMode && location.pathname !== '/cabinet/today' && (
          <ErrorBoundary section="Кабинет" key="cabinet-client-boundary">
            <TherapistClientSheet
              view={openClientId ? 'client' : 'list'}
              openClientId={openClientId}
              onViewChange={(v) => v === 'list' ? navigate('/cabinet') : null}
              onOpenClient={(id) => navigate('/cabinet/' + id)}
              onClose={() => switchTherapistMode(false)}
              backHandlerRef={therapistBackHandlerRef}
              onClientsChange={setTherapistClients}
            />
          </ErrorBoundary>
        )}

        {/* Regular sections */}
        {!therapistMode && (
          <div className="page animate-fade" key={section}>
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
                onOpenTherapistCabinet={() => { switchTherapistMode(true); }}
              />
            )}
            {section === 'diary' && (
              <ErrorBoundary section="Дневник" key="diary-boundary">
                <DiarySection />
              </ErrorBoundary>
            )}
            {section === 'schemas' && (
              <ErrorBoundary section="Паттерны" key="schemas-boundary">
                <SchemasSection
                  onOpenSchema={(opts) => { setSchemaAutoStartTest(!!opts?.startTest); setSchemaInitialTab(opts?.tab ?? 'needs'); setSchemaHighlight(opts?.highlight); setShowSchemaInfo(true); }}
                  childhoodRatings={childhoodRatings}
                  onOpenChildhoodWheel={() => setShowChildhoodWheel(true)}
                />
              </ErrorBoundary>
            )}
            {section === 'profile' && (
              <ProfileSection
                onOpenSettings={() => setShowSettings(true)}
                onOpenTracker={() => { setTrackerNeedId(null); setShowTrackerOverlay(true); }}
                refreshKey={profileRefreshKey}
                displayName={displayName}
              />
            )}
            {section === 'practice' && (
              <ErrorBoundary section="Практика" key="practice-boundary">
                <PracticeSection
                  onOpenChildhoodWheel={() => setShowChildhoodWheel(true)}
                  onOpenPractices={() => setShowPractices(true)}
                  onOpenPlans={() => setShowPlans(true)}
                  onOpenTracker={() => { setTrackerNeedId(null); setShowTrackerOverlay(true); }}
                  onOpenDiaries={() => setShowDiaries(true)}
                  onOpenSchema={(opts) => { setSchemaAutoStartTest(!!opts?.startTest); setSchemaInitialTab(opts?.tab ?? 'needs'); setShowSchemaInfo(true); }}
                  refreshKey={helpTasksKey}
                  onTasksChanged={() => { api.getTasks().then(setHelpTasks).catch(() => {}); setHelpTasksKey(k => k + 1); }}
                />
              </ErrorBoundary>
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
          <Suspense fallback={null}>
            <HistorySheet
              needs={needs}
              history={history}
              historyLoading={historyLoading}
              ratings={ratings}
              childhoodRatings={childhoodRatings}
              pendingPlans={pendingPlans}
              todayDate={TODAY_DATE}
              historyDays={historyDays}
              onClose={() => { setShowTracker(false); setTrackerTab('today'); }}
              onOpenTracker={() => { setTrackerTab('today'); setTrackerNeedId(null); setShowTrackerOverlay(true); }}
              onOpenSchemas={() => setShowSchemaInfo(true)}
              onOpenChildhoodWheel={() => setShowChildhoodWheel(true)}
              onDismissPlan={(id) => setPendingPlans(prev => prev.filter(p => p.id !== id))}
              onHistoryRefreshed={(h) => { setHistory(h); setHistoryLoading(false); }}
            />
          </Suspense>
        )}

        {/* ── Diaries overlay ── */}
        {showDiaries && (
          <Suspense fallback={null}>
            <DiariesOverlay onClose={() => setShowDiaries(false)} />
          </Suspense>
        )}

        {/* ── Fullscreen overlays ── */}
        {showSettings && (
          <SettingsSheet
            onClose={() => setShowSettings(false)}
            userRole={userRole}
            displayName={displayName}
            onNameChanged={setDisplayName}
            onOpenTherapistCabinet={() => { setShowSettings(false); navigate('/cabinet'); }}
            therapistMode={therapistMode}
            onToggleTherapistMode={() => switchTherapistMode(!therapistMode)}
            onResignTherapist={async () => {
              await api.resignTherapist();
              setUserRole('CLIENT');
              localStorage.setItem('therapist_mode', '0');
              setShowSettings(false);
              navigate('/today');
            }}
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
          <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
            <ChildhoodWheelEx
              onBack={() => setShowChildhoodWheel(false)}
              onSaved={(r) => setChildhoodRatings(r)}
            />
          </div>
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
        {showTherapistDisclaimer && (
          <TherapistPrivacyDisclaimer onDone={() => {
            // Persist on ANY close path (button OR browser-back), otherwise a
            // back-button dismissal leaves the flag unset and the disclaimer
            // re-shows on every entry into the therapist cabinet.
            localStorage.setItem('therapist_privacy_disclaimer_seen', '1');
            setShowTherapistDisclaimer(false);
          }} />
        )}

        {/* ── Celebration ── */}
        {celebrationStreak !== null && (
          <Celebration streak={celebrationStreak} insight={todayInsightPhrase(ratings)} onDone={() => { setCelebrationStreak(null); setShowTodayNote(true); }} />
        )}

        </Suspense>
        </div>{/* end canvas */}
      </div>{/* end main */}

      {/* ── Mobile bottom nav ──────────────────────────────────────────────── */}
      <nav className="mobile-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.id}
            to={'/' + item.id}
            className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          >
            <MobileNavIcon id={item.id} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* ── Command palette ─────────────────────────────────────────────────── */}
      {cmdOpen && (
        <CommandPalette
          section={section}
          onNavigate={(s) => { setSection(s); }}
          onClose={() => setCmdOpen(false)}
          userRole={userRole}
          therapistMode={therapistMode}
          onToggleMode={() => switchTherapistMode(!therapistMode)}
          onOpenClient={(id) => { navigate('/cabinet/' + id); }}
          onNewDiaryEntry={() => { navigate('/diary'); }}
        />
      )}

      {/* Periodic donate nudge (once ~monthly, dismissible) */}
      <DonateNudge />
    </div>
  );
}
