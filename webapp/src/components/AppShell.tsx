import { lazy, Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate, useParams, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useTr } from '../utils/addressForm';
import { api } from '../api';
import type { DayHistory } from '../types';
import { applyCabinetLightTheme } from '../utils/theme';
import { syncMotionAttr } from '../utils/reducedMotion';
import { shouldShowChildhoodWheel } from '../utils/storageKeys';
import { CommandPalette } from './CommandPalette';
import { Loader } from './Loader';
import { useBootstrapLoad, TODAY_DATE, TODAY_KEY } from './appShell/useBootstrapLoad';
import { useOverlays } from './appShell/useOverlays';
import { AppOverlays } from './appShell/AppOverlays';
import { EntryFlows } from './appShell/EntryFlows';
import { AppSections } from './appShell/AppSections';
import { type Section, sectionFromPath, fillHistoryGaps } from './appShell/navigation';
import { MobileNav } from './appShell/MobileNav';
import { QuickActions } from './quickActions/QuickActions';
import { useDesktopAppLaunch } from '../hooks/useDesktopAppLaunch';
import { useHostShell } from '../hooks/useHostShell';
import { useIsOffline } from '../hooks/useIsOffline';
import { useOutboxFlushOnOnline } from '../hooks/useOutboxFlushOnOnline';
import { OfflineBanner } from './OfflineBanner';
// – always-needed small helpers (no heavy data deps) –
import { Celebration } from './Celebration';
import { todayInsightPhrase } from '../utils/todayInsight';
import { DonateNudge } from './DonateNudge';
import { SECTION_HUE, clientHue, hueStyle } from '../lib/tone';

// – lazy: heavy overlays –
// SettingsSheet/PracticesScreen/PlansScreen/SchemaInfoSheet/ChildhoodWheelEx/
// TherapistPrivacyDisclaimer — appShell/AppOverlays.tsx; секции/кабинет
// терапевта — appShell/AppSections.tsx (тоже правило №10).
const TrackerOverlay = lazy(() => import('./TrackerOverlay').then(m => ({ default: m.TrackerOverlay })));
const DiariesOverlay = lazy(() => import('./DiariesOverlay').then(m => ({ default: m.DiariesOverlay })));
const HistorySheet   = lazy(() => import('./HistorySheet').then(m => ({ default: m.HistorySheet })));

import type { StreakData } from '../api';
import { parseRouteUserId } from '../../../shared/src/utils/sameId';

// Кабинет — только светлая тема (решение владельца 2026-10-15); тумблер темы живёт на лендинге.
applyCabinetLightTheme();
syncMotionAttr();

// Три вкладки (редизайн 2026-10, docs/design/CLIENT_SIMPLE_2026-10.md):
// «Паттерны», «Практика» и «Профиль» открываются из «Ещё» и по прямому URL.
const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'diary', label: 'Записи' },
  { id: 'more',  label: 'Ещё' },
];

export function AppShell() {
  const { logout } = useAuth();
  // Запуск установленного приложения на компьютере приходит сюда (?from=app).
  useDesktopAppLaunch();
  useHostShell();
  const tr = useTr();
  const location = useLocation();
  const navigate = useNavigate();
  const { clientId: clientIdParam } = useParams<{ clientId?: string }>();

  // ── Section and therapist mode derived from URL ────────────────────────────
  const section: Section = useMemo(() => sectionFromPath(location.pathname), [location.pathname]);
  const setSection = useCallback((s: Section) => navigate('/' + s), [navigate]);

  const therapistMode = location.pathname.startsWith('/cabinet');
  const openClientId = parseRouteUserId(clientIdParam);

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
    needs, ratings, setRatings, setSaved, yesterdayRatings,
    loading, error,
    userRole, setUserRole,
    displayName, setDisplayName,
    pendingPlans, setPendingPlans,
    childhoodRatings, setChildhoodRatings,
    therapistClients, setTherapistClients,
  } = useBootstrapLoad({ navigate, initialPathname: location.pathname });

  const [history, setHistory] = useState<DayHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const isOffline = useIsOffline();
  useOutboxFlushOnOnline();
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

  // Global ⌘K + ⌘1–3 section shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ov.setCmdOpen(true); return; }
      if (!therapistMode && e.metaKey) {
        const map: Record<string, Section> = { '1': 'today', '2': 'diary', '3': 'more' };
        if (map[e.key]) { e.preventDefault(); setSection(map[e.key] as Section); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ov.setCmdOpen стабильный сеттер useState; ov как объект не нужен в deps (не хотим переустанавливать обработчик на каждый чужой оверлей)
  }, [therapistMode, setSection]);

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

  // Сиблинги контейнера секций ниже (Tracker/History/Diaries/Celebration/
  // AppOverlays) — `inert` на контейнере прячет фон от таба/скринридера,
  // пока хоть один открыт (аудит 2026-09: «Помощь рядом» читалась сквозь каталог практик).
  const anyOverlayOpen = ov.showTrackerOverlay || ov.showTracker || ov.showDiaries
    || ov.showSchemaInfo || ov.showSettings || ov.showPractices || ov.showPlans
    || ov.showChildhoodWheel || ov.showTodayNote
    || ov.showTherapistDisclaimer || ov.quickAction !== null || celebrationStreak !== null;

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
    <div className="app-shell light-lock">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sb-brand">
          <div className="sb-logo">В</div>
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
          {!therapistMode && NAV_ITEMS.map(item => (
            <NavLink key={item.id} to={'/' + item.id}
                     className={({ isActive }) => `sb-item${isActive ? ' is-active' : ''}`}>
              <span className="sb-dot" style={hueStyle(SECTION_HUE[item.id])} />{item.label}
            </NavLink>
          ))}
          {therapistMode && (<>
            <NavLink to="/cabinet/today"
                     className={({ isActive }) => `sb-item${isActive ? ' is-active' : ''}`}>
              <span>Сегодня</span>
            </NavLink>
            <NavLink to="/cabinet" end
                     className={({ isActive }) => `sb-item${isActive ? ' is-active' : ''}`}>
              <span>Все клиенты</span><span className="badge">{therapistClients.length || ''}</span>
            </NavLink>
            {therapistClients.length > 0 && (
              <div className="sb-clients">
                <div className="sb-section-label">Клиенты</div>
                {therapistClients.length > 4 && (
                  <input className="sb-search" value={clientSearch} placeholder="Поиск клиента…"
                         onChange={e => setClientSearch(e.target.value)} />
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
                        <span className="sb-client-av" style={hueStyle(clientHue(c.telegramId))}>{name.slice(0, 2).toUpperCase()}</span>
                        <span className="sb-client-name">{name}</span>
                        {activeToday && <span className="sb-active-dot" />}
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
            <div className="u-fill">
              <div className="sb-acc-name">{displayName || 'Профиль'}</div>
              <div className="sb-acc-role">{userRole === 'THERAPIST' ? 'Терапевт' : 'Клиент'}</div>
            </div>
          </NavLink>
          <div className="sb-links">
            <button className="sb-item" onClick={() => ov.setShowSettings(true)}>Настройки</button>
            <NavLink to="/account" className="sb-item">Аккаунт</NavLink>
            <button className="sb-item sb-danger" onClick={() => logout()}>Выйти</button>
          </div>
          <div className="sb-links sb-legal">
            <a href="/privacy" target="_blank">Конфиденциальность</a>
            <a href="/offer" target="_blank">Оферта</a>
          </div>
        </div>
        </div>{/* end sb-foot-wrap */}
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className={`main${therapistMode ? ' main--cabinet' : ''}`}>
        <OfflineBanner offline={isOffline} />
        {/* Topbar – shown in all modes */}
        <div className="topbar">
          <div className="t-spacer" />
          {isOffline && <span className="topbar-offline">офлайн</span>}
          {!therapistMode && (
            <button className="topbar-sos tone-tint" style={hueStyle(28)}
                    onClick={() => navigate('/practice', { state: { openFlashcard: true } })}>Мне плохо</button>
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
          Аудит 2026-08-22: AppSections (основной контент) и все ленивые
          шторки ниже — сиблинги с раздельными Suspense-границами, а не один
          общий boundary: иначе догрузка чанка шторки прятала бы под фолбэк
          уже отрисованный раздел под ней (fallback={null} у шторок — контент
          рядом никуда не девается, пока грузится их чанк).
          Аудит 2026-09: тот же фон оставался доступным таба/скринридеру
          сквозь открытый оверлей — AppSections получает inert=anyOverlayOpen.
        */}
        <AppSections
          inert={anyOverlayOpen}
          therapistMode={therapistMode}
          pathname={location.pathname}
          section={section}
          needs={needs}
          ratings={ratings}
          displayName={displayName}
          navigate={navigate}
          openClientId={openClientId}
          switchTherapistMode={switchTherapistMode}
          therapistBackHandlerRef={therapistBackHandlerRef}
          setTherapistClients={setTherapistClients}
          setSection={setSection}
          ov={ov}
          todayRefreshKey={todayRefreshKey}
          userRole={userRole}
          profileRefreshKey={profileRefreshKey}
          childhoodRatings={childhoodRatings}
          helpTasksKey={helpTasksKey}
          setHelpTasksKey={setHelpTasksKey}
        />

        {/* ── TrackerOverlay ── */}
        {ov.showTrackerOverlay && (
          <Suspense fallback={null}>
            <TrackerOverlay
              needs={needs}
              ratings={ratings}
              isOffline={isOffline}
              onChange={handleChange}
              onSaved={handleSaved}
              onClose={() => { ov.setShowTrackerOverlay(false); ov.setTrackerNeedId(null); }}
              initialNeedId={ov.trackerNeedId}
              onOpenNote={() => ov.setShowTodayNote(true)}
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
            <DiariesOverlay onClose={() => ov.setShowDiaries(false)} onOpenTracker={() => { ov.setShowDiaries(false); ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }} />
          </Suspense>
        )}

        {/* Согласия и ссылки-приглашения (EntryFlows), затем шторки (AppOverlays, правило №10) */}
        <EntryFlows ov={ov} />
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
      <MobileNav items={NAV_ITEMS} therapist={therapistMode} onSearch={() => ov.setCmdOpen(true)} />

      <QuickActions ov={ov} showButton={!therapistMode && section === 'diary'} />
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
          onQuickAction={ov.runQuickAction}
        />
      )}

      {/* Periodic donate nudge (once ~monthly, dismissible) */}
      <DonateNudge />
    </div>
  );
}
