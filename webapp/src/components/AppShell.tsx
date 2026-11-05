import { lazy, Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTr } from '../utils/addressForm';
import { api } from '../api';
import type { DayHistory } from '../types';
import { useCabinetLightTheme } from '../utils/useCabinetLightTheme';
import { syncMotionAttr } from '../utils/reducedMotion';
import { shouldShowChildhoodWheel, THERAPIST_MODE_KEY } from '../utils/storageKeys';
import { CommandPalette } from './CommandPalette';
import { useBootstrapLoad } from './appShell/useBootstrapLoad';
import { celebratedKey } from '../../../shared/src/utils/todayConstants';
import { useOverlays } from './appShell/useOverlays';
import { AppOverlays } from './appShell/AppOverlays';
import { EntryFlows } from './appShell/EntryFlows';
import { EntryFlowsDoneContext } from './appShell/entryQueue';
import { AppSections } from './appShell/AppSections';
import { AppShellSkeleton } from './appShell/AppShellSkeleton';
import { Sidebar } from './appShell/Sidebar';
import { type Section, sectionFromPath, fillHistoryGaps } from './appShell/navigation';
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
import { hueStyle } from '../lib/tone';

// – lazy: heavy overlays –
// SettingsSheet/PracticesScreen/PlansScreen/SchemaInfoSheet/ChildhoodWheelEx/
// TherapistPrivacyDisclaimer — appShell/AppOverlays.tsx; секции/кабинет
// терапевта — appShell/AppSections.tsx (тоже правило №10).
const TrackerOverlay = lazy(() => import('./TrackerOverlay').then(m => ({ default: m.TrackerOverlay })));
const DiariesOverlay = lazy(() => import('./DiariesOverlay').then(m => ({ default: m.DiariesOverlay })));
const HistorySheet   = lazy(() => import('./HistorySheet').then(m => ({ default: m.HistorySheet })));

import type { StreakData } from '../api';
import { parseRouteUserId } from '../../../shared/src/utils/sameId';

syncMotionAttr();

// Три вкладки (редизайн 2026-10, docs/design/CLIENT_SIMPLE_2026-10.md):
// «Паттерны», «Практика» и «Профиль» открываются из «Ещё» и по прямому URL.
const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'diary', label: 'Записи' },
  { id: 'more',  label: 'Ещё' },
];

export function AppShell() {
  useHostShell();
  useCabinetLightTheme(); // кабинет — только светлая тема (решение владельца 2026-10-15)
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
    localStorage.setItem(THERAPIST_MODE_KEY, on ? '1' : '0');
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

  const [history, setHistory] = useState<DayHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
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
        && !localStorage.getItem('therapist_privacy_disclaimer_seen')) {
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
    // День праздника — живой день устройства (todayDate сменяется в полночь), а не день загрузки бандла.
    const key = celebratedKey(todayDate);
    if (streak && !localStorage.getItem(key)) {
      localStorage.setItem(key, '1');
      if (streak.currentStreak > 0) setCelebrationStreak(streak.currentStreak);
      else ov.setShowTodayNote(true);
      if (streak.totalDays >= 5 && shouldShowChildhoodWheel()) setChildhoodWheelPending(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ov.setShowTodayNote стабильный сеттер useState; ov как объект не нужен в deps
  }, [setSaved, todayDate]);

  // Сиблинги контейнера секций ниже (Tracker/History/Diaries/Celebration/
  // AppOverlays) — `inert` на контейнере прячет фон от таба/скринридера,
  // пока хоть один открыт (аудит 2026-09: «Помощь рядом» читалась сквозь каталог практик).
  const anyOverlayOpen = ov.showTrackerOverlay || ov.showTracker || ov.showDiaries
    || ov.showSchemaInfo || ov.showSettings || ov.showPractices || ov.showPlans
    || ov.showChildhoodWheel || ov.showTodayNote
    || ov.showTherapistDisclaimer || ov.showSosCard || ov.quickAction !== null || celebrationStreak !== null;

  if (loading) return <AppShellSkeleton section={section} therapistMode={therapistMode} />;

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
      <Sidebar
        items={NAV_ITEMS}
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
        <OfflineBanner offline={isOffline} />
        {/* Topbar – shown in all modes */}
        <div className="topbar">
          <div className="t-spacer" />
          {isOffline && <span className="topbar-offline">офлайн</span>}
          {!therapistMode && (
            <button className="topbar-sos tone-tint" style={hueStyle(28)}
                    onClick={() => ov.setShowSosCard(true)}>Мне плохо</button>
          )}
          <button className="search-pill" onClick={() => ov.setCmdOpen(true)}>
            <span>Перейти к…</span>
            <span className="sp-spacer" />
            <span className="kbd kbd-hint">⌘K</span>
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
              history={history}
              historyLoading={historyLoading}
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
              onHistoryRefreshed={(h) => { setHistory(h); setHistoryLoading(false); }}
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
          childhoodWheelPending={childhoodWheelPending}
          setChildhoodWheelPending={setChildhoodWheelPending}
          todayDate={todayDate}
        />

        {/* ── Celebration ── */}
        {celebrationStreak !== null && (
          <Celebration streak={celebrationStreak} insight={todayInsightPhrase(ratings)} onDone={() => { setCelebrationStreak(null); ov.setShowTodayNote(true); }} />
        )}

        </div>{/* end canvas */}
      </div>{/* end main */}

      {/* ── Mobile bottom nav ──────────────────────────────────────────────── */}
      <MobileNav items={NAV_ITEMS} therapist={therapistMode} onSearch={() => ov.setCmdOpen(true)} onProfile={() => ov.setShowSettings(true)} />

      <QuickActions ov={ov} />
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
      <DonateNudge blocked={donateNudgeBlocked({ section, anyOverlayOpen, entryDone })} />
    </div>
  );
}
