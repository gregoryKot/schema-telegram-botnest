import { lazy, Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate, useParams, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useTr } from '../utils/addressForm';
import { api } from '../api';
import type { DayHistory } from '../types';
import { applyTheme, getTheme } from '../utils/theme';
import { syncMotionAttr } from '../utils/reducedMotion';
import { shouldShowChildhoodWheel } from '../utils/storageKeys';
import { CommandPalette } from './CommandPalette';
import { Loader } from './Loader';
import { ScreenSkeleton } from './Skeleton';
import { ErrorBoundary } from './ErrorBoundary';
import { useBootstrapLoad, TODAY_DATE, TODAY_KEY } from './appShell/useBootstrapLoad';
import { useOverlays } from './appShell/useOverlays';
import { AppOverlays } from './appShell/AppOverlays';
import { type Section, sectionFromPath, fillHistoryGaps } from './appShell/navigation';
import { MobileNav } from './appShell/MobileNav';
import { useDesktopAppLaunch } from '../hooks/useDesktopAppLaunch';
import { MobileAppBanner } from './MobileAppBanner';

// – always-needed small helpers (no heavy data deps) –
import { Celebration } from './Celebration';
import { todayInsightPhrase } from '../utils/todayInsight';
import { DonateNudge } from './DonateNudge';

// – lazy: sections (each can pull in schemaTherapyData / needData on demand) –
const TodaySection   = lazy(() => import('../sections/TodaySection').then(m => ({ default: m.TodaySection })));
const DiarySection   = lazy(() => import('../sections/DiarySection').then(m => ({ default: m.DiarySection })));
const SchemasSection = lazy(() => import('../sections/SchemasSection').then(m => ({ default: m.SchemasSection })));
const ProfileSection = lazy(() => import('../sections/ProfileSection').then(m => ({ default: m.ProfileSection })));
const PracticeSection = lazy(() => import('../sections/PracticeSection').then(m => ({ default: m.PracticeSection })));

// – lazy: heavy overlays –
// SettingsSheet/PracticesScreen/PlansScreen/SchemaInfoSheet/ChildhoodWheelEx/
// TherapistPrivacyDisclaimer переехали в appShell/AppOverlays.tsx (правило
// №10 — файл был на потолке 300 строк), там же их lazy()-объявления.
const TrackerOverlay       = lazy(() => import('./TrackerOverlay').then(m => ({ default: m.TrackerOverlay })));
const DiariesOverlay = lazy(() => import('./DiariesOverlay').then(m => ({ default: m.DiariesOverlay })));
const HistorySheet   = lazy(() => import('./HistorySheet').then(m => ({ default: m.HistorySheet })));
const TherapistClientSheet  = lazy(() => import('./TherapistClientSheet').then(m => ({ default: m.TherapistClientSheet })));
const TherapistTodaySection = lazy(() => import('../sections/TherapistTodaySection').then(m => ({ default: m.TherapistTodaySection })));

import type { StreakData } from '../api';

// Apply saved theme immediately before first render
applyTheme(getTheme());
syncMotionAttr();

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

export function AppShell() {
  const { logout } = useAuth();
  // Запуск установленного приложения на компьютере приходит сюда (?from=app).
  useDesktopAppLaunch();
  const tr = useTr();
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

  // Bootstrap data — needs/ratings/profile/role/therapist clients/… fetched
  // on mount; see useBootstrapLoad for the fetch + silent-failure reporting.
  const {
    needs, ratings, setRatings, saved, setSaved, yesterdayRatings,
    loading, error,
    userRole, setUserRole,
    displayName, setDisplayName,
    pendingPlans, setPendingPlans,
    childhoodRatings, setChildhoodRatings,
    therapistClients, setTherapistClients,
  } = useBootstrapLoad({ navigate, initialPathname: location.pathname });

  const [history, setHistory] = useState<DayHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [helpTasksKey, setHelpTasksKey] = useState(0);
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const [childhoodWheelPending, setChildhoodWheelPending] = useState(false);
  const [todayRefreshKey, setTodayRefreshKey] = useState(0);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);

  // Overlay state (флаги видимости и их сеттеры — appShell/useOverlays.ts)
  const ov = useOverlays();

  // First entry into the cabinet as a therapist → one-time privacy disclaimer
  useEffect(() => {
    if (therapistMode && userRole === 'THERAPIST'
        && !localStorage.getItem('therapist_privacy_disclaimer_seen')) {
      ov.setShowTherapistDisclaimer(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ov.setShowTherapistDisclaimer стабильный сеттер useState (как и остальные поля ov); сам объект ov — новый на каждый рендер, добавление его в deps перезапускало бы эффект от любого несвязанного оверлея
  }, [therapistMode, userRole]);

  // Therapist clients search (client list itself comes from useBootstrapLoad)
  const [clientSearch, setClientSearch] = useState('');

  // Therapist cabinet navigation helpers (URL-based)
  const therapistBackHandlerRef = useRef<() => void>(() => navigate('/cabinet'));

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (therapistMode) return ['Кабинет'];
    return [SECTION_LABELS[section]];
  }, [therapistMode, section]);


  // Global ⌘K + ⌘1–5 section shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ov.setCmdOpen(true); return; }
      if (!therapistMode && e.metaKey) {
        const map: Record<string, Section> = { '1': 'today', '2': 'diary', '3': 'schemas', '4': 'practice' };
        if (map[e.key]) { e.preventDefault(); setSection(map[e.key] as Section); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ov.setCmdOpen стабильный сеттер useState; ov как объект не нужен в deps (не хотим переустанавливать обработчик на каждый чужой оверлей)
  }, [therapistMode, setSection]);

  // Online/offline
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => { window.removeEventListener('offline', handleOffline); window.removeEventListener('online', handleOnline); };
  }, []);

  // Show the history loading state the moment the history tab is opened.
  // Adjusting state during render (not in an effect) keeps this off
  // set-state-in-effect; the fetch itself runs in the effect below.
  const [seenTrackerTab, setSeenTrackerTab] = useState(ov.trackerTab);
  if (ov.trackerTab !== seenTrackerTab) {
    setSeenTrackerTab(ov.trackerTab);
    if (ov.trackerTab === 'history') setHistoryLoading(true);
  }

  // History load when tracker history tab opens (historyDays is a constant).
  useEffect(() => {
    if (ov.trackerTab !== 'history') return;
    let alive = true;
    api.history(historyDays)
      .then(h => { if (alive) setHistory(fillHistoryGaps(h)); })
      .finally(() => { if (alive) setHistoryLoading(false); });
    return () => { alive = false; };
  }, [ov.trackerTab]);

  // Refresh Today after overlays close
  const prevOverlayRef = useRef(false);
  useEffect(() => {
    const anyOpen = ov.showTrackerOverlay || ov.showTracker || ov.showDiaries || ov.showSchemaInfo;
    if (!anyOpen && prevOverlayRef.current) setTodayRefreshKey(k => k + 1);
    prevOverlayRef.current = anyOpen;
  }, [ov.showTrackerOverlay, ov.showTracker, ov.showDiaries, ov.showSchemaInfo]);

  // Refresh Profile after overlays close
  const prevProfileOverlayRef = useRef(false);
  useEffect(() => {
    const anyOpen = ov.showSettings || ov.showPractices || ov.showPlans || ov.showTrackerOverlay || ov.showTracker || ov.showChildhoodWheel;
    if (!anyOpen && prevProfileOverlayRef.current && section === 'profile') {
      setProfileRefreshKey(k => k + 1);
    }
    prevProfileOverlayRef.current = anyOpen;
  }, [ov.showSettings, ov.showPractices, ov.showPlans, ov.showTrackerOverlay, ov.showTracker, ov.showChildhoodWheel, section]);

  const handleChange = useCallback((needId: string, value: number) => {
    setRatings(prev => ({ ...prev, [needId]: value }));
    setSaved(prev => ({ ...prev, [needId]: false }));
  }, [setRatings, setSaved]);

  const handleSaved = useCallback((needId: string, streak?: StreakData) => {
    setSaved(prev => ({ ...prev, [needId]: true }));
    if (streak && !localStorage.getItem(TODAY_KEY)) {
      localStorage.setItem(TODAY_KEY, '1');
      if (streak.currentStreak > 0) setCelebrationStreak(streak.currentStreak);
      else ov.setShowTodayNote(true);
      if (streak.totalDays >= 5 && shouldShowChildhoodWheel()) setChildhoodWheelPending(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ov.setShowTodayNote стабильный сеттер useState; ov как объект не нужен в deps
  }, [setSaved]);

  if (loading) {
    return <Loader minHeight="100vh" />;
  }

  if (error) {
    return (
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>Не удалось загрузить</div>
        <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>{tr('Проверь подключение и попробуй ещё раз', 'Проверьте подключение и попробуйте ещё раз')}</div>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', border: 'none', borderRadius: 'var(--r-8)', background: 'var(--text)', color: 'var(--bg)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
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
                        width: '100%', padding: '5px 9px', borderRadius: 'var(--r-6)',
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
                          onClick={() => { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}>
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
          <button className="sb-item" onClick={() => ov.setShowSettings(true)} style={{ marginTop: 2 }}>
            <span>Настройки</span>
          </button>
          <NavLink to="/account" className="sb-item" style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
            <span>Аккаунт и привязки</span>
          </NavLink>
          <button className="sb-item sb-danger" onClick={() => logout()}
                  style={{ marginTop: 2 }}>
            <span>Выйти</span>
          </button>
          <div style={{ display: 'flex', gap: 'var(--space-12)', padding: '8px 0 0', borderTop: '1px solid var(--line)', marginTop: 4 }}>
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
          <button className="search-pill" onClick={() => ov.setCmdOpen(true)}>
            <span>Перейти к…</span>
            <span className="sp-spacer" />
            <span className="kbd">⌘K</span>
          </button>
        </div>

        {/* Canvas */}
        <div className="canvas">
        {/*
          Аудит 2026-08-22: раньше ОДИН Suspense накрывал и основной контент
          (разделы/кабинет терапевта), и ВСЕ ленивые шторки поверх него — если
          шторка ещё качала свой чанк, React прятал под фолбэк весь общий
          Suspense-boundary целиком, то есть уже отрисованный раздел под ней.
          Ниже — своя Suspense-граница на каждую независимую сущность:
          основной контент получает силуэт экрана (он и правда заменяется
          целиком), а шторки поверх — fallback={null}, потому что контент под
          ними никуда не девается, пока грузится чанк шторки.
        */}
        <Suspense fallback={<ScreenSkeleton />}>

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
            <MobileAppBanner />
            {section === 'today' && (
              <TodaySection
                needs={needs}
                ratings={ratings}
                yesterdayRatings={yesterdayRatings}
                onNavigate={setSection}
                onOpenSchema={(opts) => { ov.setSchemaAutoStartTest(!!opts?.startTest); ov.setSchemaInitialTab(opts?.tab ?? 'needs'); ov.setSchemaHighlight(opts?.highlight); ov.setShowSchemaInfo(true); }}
                onOpenAdvanced={() => ov.setShowSettings(true)}
                onOpenTracker={() => { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
                onOpenTrackerAt={(needId) => { ov.setTrackerNeedId(needId); ov.setShowTrackerOverlay(true); }}
                onOpenTrackerHistory={() => { ov.setTrackerTab('history'); ov.setShowTracker(true); }}
                onOpenDiaries={() => ov.setShowDiaries(true)}
                onOpenChildhoodWheel={() => ov.setShowChildhoodWheel(true)}
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
                  onOpenSchema={(opts) => { ov.setSchemaAutoStartTest(!!opts?.startTest); ov.setSchemaInitialTab(opts?.tab ?? 'needs'); ov.setSchemaHighlight(opts?.highlight); ov.setShowSchemaInfo(true); }}
                  childhoodRatings={childhoodRatings}
                  onOpenChildhoodWheel={() => ov.setShowChildhoodWheel(true)}
                />
              </ErrorBoundary>
            )}
            {section === 'profile' && (
              <ProfileSection
                onOpenSettings={() => ov.setShowSettings(true)}
                onOpenTracker={() => { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
                refreshKey={profileRefreshKey}
                displayName={displayName}
              />
            )}
            {section === 'practice' && (
              <ErrorBoundary section="Практика" key="practice-boundary">
                <PracticeSection
                  onOpenChildhoodWheel={() => ov.setShowChildhoodWheel(true)}
                  onOpenPractices={() => ov.setShowPractices(true)}
                  onOpenPlans={() => ov.setShowPlans(true)}
                  onOpenTracker={() => { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
                  onOpenDiaries={() => ov.setShowDiaries(true)}
                  onOpenSchema={(opts) => { ov.setSchemaAutoStartTest(!!opts?.startTest); ov.setSchemaInitialTab(opts?.tab ?? 'needs'); ov.setShowSchemaInfo(true); }}
                  refreshKey={helpTasksKey}
                  onTasksChanged={() => setHelpTasksKey(k => k + 1)}
                />
              </ErrorBoundary>
            )}
          </div>
        )}

        </Suspense>
        {/* Конец Suspense-границы основного контента — дальше только шторки
            поверх него, у каждой своя граница (см. комментарий выше). */}

        {/* ── TrackerOverlay ── */}
        {ov.showTrackerOverlay && (
          <Suspense fallback={null}>
            <TrackerOverlay
              needs={needs}
              ratings={ratings}
              saved={saved}
              isOffline={isOffline}
              onChange={handleChange}
              onSaved={handleSaved}
              onClose={() => { ov.setShowTrackerOverlay(false); ov.setTrackerNeedId(null); }}
              initialNeedId={ov.trackerNeedId}
              onOpenNote={() => ov.setShowTodayNote(true)}
              onOpenGoal={() => ov.setShowTrackerGoal(true)}
              onOpenHistory={() => { ov.setShowTrackerOverlay(false); ov.setTrackerNeedId(null); ov.setTrackerTab('history'); ov.setShowTracker(true); }}
              yesterdayRatings={yesterdayRatings}
            />
          </Suspense>
        )}

        {/* ── History overlay ── */}
        {ov.showTracker && (
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
              onClose={() => { ov.setShowTracker(false); ov.setTrackerTab('today'); }}
              onOpenTracker={() => { ov.setTrackerTab('today'); ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
              onOpenSchemas={() => ov.setShowSchemaInfo(true)}
              onOpenChildhoodWheel={() => ov.setShowChildhoodWheel(true)}
              onDismissPlan={(id) => setPendingPlans(prev => prev.filter(p => p.id !== id))}
              onHistoryRefreshed={(h) => { setHistory(h); setHistoryLoading(false); }}
            />
          </Suspense>
        )}

        {/* ── Diaries overlay ── */}
        {ov.showDiaries && (
          <Suspense fallback={null}>
            <DiariesOverlay onClose={() => ov.setShowDiaries(false)} />
          </Suspense>
        )}

        {/* ── Полноэкранные шторки (настройки/практики/планы/справочник схем/
            колесо детства/заметка/цель/дисклеймер кабинета) — вынесены в
            AppOverlays.tsx (правило №10), каждая со своей Suspense-границей
            (fallback={null} — контент под ней уже смонтирован отдельно
            выше, аудит 2026-08-22, находка №1). */}
        <AppOverlays
          ov={ov}
          userRole={userRole}
          setUserRole={setUserRole}
          displayName={displayName}
          setDisplayName={setDisplayName}
          therapistMode={therapistMode}
          switchTherapistMode={switchTherapistMode}
          navigate={navigate}
          ratings={ratings}
          setChildhoodRatings={setChildhoodRatings}
          childhoodWheelPending={childhoodWheelPending}
          setChildhoodWheelPending={setChildhoodWheelPending}
          todayDate={TODAY_DATE}
        />

        {/* ── Celebration ── */}
        {celebrationStreak !== null && (
          <Celebration streak={celebrationStreak} insight={todayInsightPhrase(ratings)} onDone={() => { setCelebrationStreak(null); ov.setShowTodayNote(true); }} />
        )}

        </div>{/* end canvas */}
      </div>{/* end main */}

      {/* ── Mobile bottom nav ──────────────────────────────────────────────── */}
      <MobileNav items={NAV_ITEMS} />

      {/* ── Command palette ─────────────────────────────────────────────────── */}
      {ov.cmdOpen && (
        <CommandPalette
          section={section}
          onNavigate={(s) => { setSection(s); }}
          onClose={() => ov.setCmdOpen(false)}
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
