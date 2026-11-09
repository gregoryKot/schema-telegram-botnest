import { lazy, Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, type StreakData } from '../api';
import { useCabinetLightTheme } from '../utils/useCabinetLightTheme';
import { syncMotionAttr } from '../utils/reducedMotion';
import { shouldShowChildhoodWheel } from '../utils/storageKeys';
import { cacheTherapistMode } from './appShell/therapistModeCache';
import { isTherapistDisclaimerSeen } from './therapistDisclaimerSeen';
import { useBootstrapLoad } from './appShell/useBootstrapLoad';
import { isCelebrated, markCelebrated } from '../../../shared/src/utils/todayConstants';
import { useOverlays } from './appShell/useOverlays';
import { AppOverlays } from './appShell/AppOverlays';
import { EntryFlows } from './appShell/EntryFlows';
import { EntryFlowsDoneContext } from './appShell/entryQueue';
import { AppSections } from './appShell/AppSections';
import { AppShellSkeleton } from './appShell/AppShellSkeleton';
import { Sidebar } from './appShell/Sidebar';
import { type Section, sectionFromPath } from './appShell/navigation';
import { useTrackerHistory } from './appShell/useTrackerHistory';
import { MOBILE_NAV_ITEMS, DESKTOP_NAV_ITEMS } from './appShell/navItems';
import '../styles/client-frame.css'; // рамка клиентских страниц на ≥768 (#925)
import { MobileNav } from './appShell/MobileNav';
import { QuickActions } from './quickActions/QuickActions';
import { useHostShell } from '../hooks/useHostShell';
import { useIsOffline } from '../hooks/useIsOffline';
import { useOutboxFlushOnOnline } from '../hooks/useOutboxFlushOnOnline';
import { OfflineBanner } from './OfflineBanner';
// – always-needed small helpers (no heavy data deps) –
import { Celebration } from './Celebration';
import { todayInsightPhrase } from '../utils/todayInsight';
import { DonateNudge } from './DonateNudge';
import { donateNudgeBlocked } from './donateNudgeBlocked';
import { LoadErrorScreen } from './appShell/LoadErrorScreen';
import { ShellTopbar } from './appShell/ShellTopbar';

// – lazy: heavy overlays –
// SettingsSheet/PracticesScreen/PlansScreen/SchemaInfoSheet/ChildhoodWheelEx/
// TherapistPrivacyDisclaimer — appShell/AppOverlays.tsx; секции/кабинет
// терапевта — appShell/AppSections.tsx (тоже правило №10).
const TrackerOverlay = lazy(() => import('./TrackerOverlay').then(m => ({ default: m.TrackerOverlay })));
const DiariesOverlay = lazy(() => import('./DiariesOverlay').then(m => ({ default: m.DiariesOverlay })));
const HistorySheet   = lazy(() => import('./HistorySheet').then(m => ({ default: m.HistorySheet })));
const CommandPalette = lazy(() => import('./CommandPalette').then(m => ({ default: m.CommandPalette }))); // ⌘K — по требованию

import { withRating } from '../../../shared/src/needs/ratingRecord';
import { clientPath, parseClientRef } from '../../../shared/src/utils/clientRef';

syncMotionAttr();

export function AppShell() {
  useHostShell();
  useCabinetLightTheme(); // кабинет — только светлая тема (решение владельца 2026-10-15)
  const location = useLocation();
  const navigate = useNavigate();
  const { clientId: clientIdParam } = useParams<{ clientId?: string }>();

  // ── Section and therapist mode derived from URL ────────────────────────────
  const section: Section = useMemo(() => sectionFromPath(location.pathname), [location.pathname]);
  const setSection = useCallback((s: Section) => { navigate('/' + s); }, [navigate]);

  const therapistMode = location.pathname.startsWith('/cabinet');
  const openClientRef = parseClientRef(clientIdParam); // код карточки или старый числовой id

  // Remember last path per mode so the toggle returns user to where they were
  useEffect(() => {
    if (therapistMode) localStorage.setItem('last_cabinet_path', location.pathname);
    else if (location.pathname !== '/' && !location.pathname.startsWith('/cabinet')) {
      localStorage.setItem('last_client_path', location.pathname);
    }
  }, [location.pathname, therapistMode]);

  const switchTherapistMode = useCallback((on: boolean, persist = true) => {
    cacheTherapistMode(on);
    // Запоминаем стартовое предпочтение на сервере (source of truth). Сервер принимает флаг только у THERAPIST — эндпоинт вернёт
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
    todayDate,
  } = useBootstrapLoad({ navigate, initialPathname: location.pathname });

  const isOffline = useIsOffline();
  useOutboxFlushOnOnline();
  const [helpTasksKey, setHelpTasksKey] = useState(0);
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const [childhoodWheelPending, setChildhoodWheelPending] = useState(false);
  const [todayRefreshKey, setTodayRefreshKey] = useState(0);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [entryDone, setEntryDone] = useState(false);

  // Overlay state (флаги видимости и их сеттеры — appShell/useOverlays.ts)
  const ov = useOverlays();

  // First entry into the cabinet as a therapist → one-time privacy disclaimer
  useEffect(() => {
    if (therapistMode && userRole === 'THERAPIST'
        && !isTherapistDisclaimerSeen()) {
      ov.setShowTherapistDisclaimer(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ov.setShowTherapistDisclaimer стабильный сеттер useState (как и остальные поля ov); сам объект ov — новый на каждый рендер, добавление его в deps перезапускало бы эффект от любого несвязанного оверлея
  }, [therapistMode, userRole]);

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

  // История трекера грузится, когда открыли вкладку; сбой ≠ пусто (useTrackerHistory).
  const hist = useTrackerHistory(ov.trackerTab, historyDays);

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
    setRatings(prev => withRating(prev, needId, value)); // 0 — откат к «не было оценки»: ключа нет
    setSaved(prev => ({ ...prev, [needId]: false }));
  }, [setRatings, setSaved]);

  const handleSaved = useCallback((needId: string, streak?: StreakData) => {
    setSaved(prev => ({ ...prev, [needId]: true }));
    // День праздника — живой день устройства (todayDate сменяется в полночь), а не день загрузки бандла.
    // Заметка дня сама не открывается — она ссылкой на экране «Готово» трекера (2026-11-06).
    if (streak && !isCelebrated(todayDate)) {
      markCelebrated(todayDate);
      if (streak.currentStreak > 0) setCelebrationStreak(streak.currentStreak);
      if (streak.totalDays >= 5 && shouldShowChildhoodWheel()) setChildhoodWheelPending(true);
    }
  }, [setSaved, todayDate]);

  // Сиблинги контейнера секций ниже (Tracker/History/Diaries/Celebration/
  // AppOverlays) — `inert` на контейнере прячет фон от таба/скринридера,
  // пока хоть один открыт (аудит 2026-09: «Помощь рядом» читалась сквозь каталог практик).
  const anyOverlayOpen = ov.showTrackerOverlay || ov.showTracker || ov.showDiaries
    || ov.showSchemaInfo || ov.showSettings || ov.showPractices || ov.showPlans
    || ov.showChildhoodWheel || ov.showTodayNote
    || ov.showTherapistDisclaimer || ov.showSosCard || ov.quickAction !== null || celebrationStreak !== null;

  if (loading) return <AppShellSkeleton section={section} therapistMode={therapistMode} pathname={location.pathname} />;

  if (error) return <LoadErrorScreen />;

  return (
    <div className="app-shell light-lock">
      <Sidebar
        items={DESKTOP_NAV_ITEMS}
        therapistMode={therapistMode}
        userRole={userRole}
        onSwitchMode={(on) => switchTherapistMode(on)}
        therapistClients={therapistClients}
        needs={needs}
        ratings={ratings}
        displayName={displayName}
        onOpenTracker={() => { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
        onOpenSettings={() => ov.setShowSettings(true)}
      />

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className={`main${therapistMode ? ' main--cabinet' : ''}`}>
        <ShellTopbar therapistMode={therapistMode} onSearch={() => ov.setCmdOpen(true)} onSos={() => ov.setShowSosCard(true)} />
        <OfflineBanner offline={isOffline} />

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
        {/* Автопоказы секций (WhySheet «Сегодня») ждут конца очереди входов — EntryFlows ниже. */}
        <EntryFlowsDoneContext.Provider value={entryDone}>
        <AppSections
          inert={anyOverlayOpen}
          therapistMode={therapistMode}
          pathname={location.pathname}
          section={section}
          needs={needs}
          ratings={ratings}
          displayName={displayName}
          navigate={navigate}
          openClientRef={openClientRef} clients={therapistClients}
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
        </EntryFlowsDoneContext.Provider>

        {/* ── TrackerOverlay ── */}
        {ov.showTrackerOverlay && (
          <Suspense fallback={null}>
            <TrackerOverlay
              needs={needs}
              ratings={ratings}
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
              history={hist.history}
              historyLoading={hist.historyLoading}
              historyFailed={hist.historyFailed}
              ratings={ratings}
              childhoodRatings={childhoodRatings}
              pendingPlans={pendingPlans}
              todayDate={todayDate}
              historyDays={historyDays}
              onClose={() => { ov.setShowTracker(false); ov.setTrackerTab('today'); }}
              onOpenTracker={() => { ov.setTrackerTab('today'); ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
              onOpenSchemas={() => ov.setShowSchemaInfo(true)}
              onOpenChildhoodWheel={() => ov.setShowChildhoodWheel(true)}
              onDismissPlan={(id) => setPendingPlans(prev => prev.filter(p => p.id !== id))}
              onHistoryRefreshed={hist.onHistoryRefreshed}
            />
          </Suspense>
        )}

        {/* ── Diaries overlay ── */}
        {ov.showDiaries && (
          <Suspense fallback={null}>
            <DiariesOverlay onClose={() => ov.setShowDiaries(false)} onOpenTrackerHistory={() => { ov.setShowDiaries(false); ov.setTrackerTab('history'); ov.setShowTracker(true); }} />
          </Suspense>
        )}

        {/* Согласия и ссылки-приглашения (EntryFlows), затем шторки (AppOverlays, правило №10) */}
        <EntryFlows ov={ov} onDone={setEntryDone} />
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
          todayDate={todayDate}
        />

        {/* ── Celebration ── */}
        {celebrationStreak !== null && (
          <Celebration streak={celebrationStreak} insight={todayInsightPhrase(ratings)} onDone={() => {
            setCelebrationStreak(null);
            if (childhoodWheelPending) { setChildhoodWheelPending(false); ov.setShowChildhoodWheel(true); }
          }} />
        )}

        </div>{/* end canvas */}
      </div>{/* end main */}

      {/* ── Mobile bottom nav ──────────────────────────────────────────────── */}
      <MobileNav items={MOBILE_NAV_ITEMS} therapist={therapistMode} onProfile={() => ov.setShowSettings(true)} />

      <QuickActions ov={ov} />
      {/* ── Command palette ─────────────────────────────────────────────────── */}
      {ov.cmdOpen && (<Suspense fallback={null}>
        <CommandPalette
          section={section}
          onNavigate={(s) => { setSection(s); }}
          onClose={() => ov.setCmdOpen(false)}
          userRole={userRole}
          therapistMode={therapistMode}
          onToggleMode={() => switchTherapistMode(!therapistMode)}
          onOpenClient={(id) => { navigate(clientPath(id, therapistClients)); }}
          onQuickAction={ov.runQuickAction}
        />
      </Suspense>)}

      {/* Periodic donate nudge (once ~monthly, dismissible) */}
      <DonateNudge blocked={donateNudgeBlocked({ section, anyOverlayOpen, entryDone })} />
    </div>
  );
}
