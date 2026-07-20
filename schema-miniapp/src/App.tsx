import { useEffect, useState, useCallback, useRef } from 'react';
import { useUserFlags, setFlag as setServerFlag } from './useUserFlags';
import { applyTheme, getTheme } from './utils/theme';
import { syncMotionAttr } from './utils/reducedMotion';
import { Need, DayHistory } from './types';

// Apply saved theme immediately before first render
applyTheme(getTheme());
syncMotionAttr();
import { api } from './api';
import { DEFAULT_SECTION_KEY } from './sections/ProfileSection';
import { Section } from './components/BottomNav';
import { TherapistClientSheet } from './components/TherapistClientSheet';
import { TodayScreenSkeleton, ScreenSkeleton } from './components/Skeleton';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from './components/YSQTestSheet';
import { shouldShowWeeklyQuestion } from './components/WeeklyQuestion';
import {
  shouldShowChildhoodWheel,
  CHILDHOOD_DONE_KEY,
} from './components/ChildhoodWheelSheet';
import { PracticePlan, PairsData, StreakData, UserTask } from './api';
import { useSafeTop } from './utils/safezone';
import { cacheTherapistContact } from './utils/therapistContact';
import { useSheets } from './hooks/useSheets';
import { useTelegramBackButton } from './hooks/useTelegramBackButton';
import { TherapistBottomNav } from './components/TherapistBottomNav';
import { TrackerHistoryOverlay } from './components/TrackerHistoryOverlay';
import {
  TODAY_KEY,
  HAS_HISTORY,
  YESTERDAY_DATE,
  fillHistoryGaps,
} from './utils/todayConstants';
import { AppSections } from './components/AppSections';
import { AppOverlays } from './components/AppOverlays';
import { AppErrorScreen } from './components/AppErrorScreen';
import { AmbientBackground } from './components/AmbientBackground';
import { OfflineBanner } from './components/OfflineBanner';
import { useOnboardingGate } from './hooks/useOnboardingGate';

type TrackerTab = 'today' | 'history';

function getInitialSection(): Section {
  const params = new URLSearchParams(window.location.search);
  const s = params.get('section');
  if (s === 'profile') return 'profile';
  if (s === 'schemas') return 'schemas';
  if (s === 'help') return 'help';
  const stored = localStorage.getItem(DEFAULT_SECTION_KEY) as Section | null;
  if (stored && ['today', 'help', 'schemas', 'profile'].includes(stored))
    return stored;
  return 'today';
}

const SECTIONS: Section[] = ['today', 'help', 'schemas', 'profile'];

export default function App() {
  const { flags: serverFlags, loaded: flagsLoaded } = useUserFlags();
  const [section, setSection] = useState<Section>(getInitialSection);
  const swipeTouchRef = useRef<{ x: number; y: number } | null>(null);
  // Первый вход (онбординг + согласие) целиком в хуке — см. useOnboardingGate.
  const onboarding = useOnboardingGate(
    serverFlags.onboardingV2Done,
    flagsLoaded,
  );
  const historyDays = 30;
  const _tabScrollPositions = useRef<Record<TrackerTab, number>>({
    today: 0,
    history: 0,
  });
  const sheets = useSheets();
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(
    null,
  );
  const [showYesterdaySheet, setShowYesterdaySheet] = useState(false);
  const [backfillDate, setBackfillDate] = useState<string | null>(null);
  const [_showYesterdayBanner, setShowYesterdayBanner] = useState(false);
  const [_showWeeklyQ, _setShowWeeklyQ] = useState(() =>
    shouldShowWeeklyQuestion(),
  );
  const [pairData, setPairData] = useState<PairsData | null>(null);
  const [_pairCardDismissed, setPairCardDismissed] = useState<boolean | null>(
    null,
  );
  const [pendingPlans, setPendingPlans] = useState<PracticePlan[]>([]);
  const [yesterdayBannerDismissed] = useState(
    () => !!localStorage.getItem('yesterday_banner_' + YESTERDAY_DATE),
  );
  const [todayRefreshKey, setTodayRefreshKey] = useState(0);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [helpPracticeCount, setHelpPracticeCount] = useState<number | null>(
    null,
  );
  const [helpPlanCount, setHelpPlanCount] = useState<number | null>(null);
  const [childhoodWheelPending, setChildhoodWheelPending] = useState(false);
  const [childhoodRatings, setChildhoodRatings] = useState<
    Record<string, number>
  >({});
  const [therapistMode, setTherapistMode] = useState(
    () => localStorage.getItem('therapist_mode') === '1',
  );
  // Роль нужна внутри switchTherapistMode (который объявлен раньше setUserRole).
  const userRoleRef = useRef<'CLIENT' | 'THERAPIST'>('CLIENT');
  // persist=true — запомнить выбор режима на сервере (source of truth: приложение
  // должно помнить, в каком режиме ты был; localStorage в Telegram WebView
  // стирается). Сервер принимает флаг только у THERAPIST — клиент escalation
  // не получит, поэтому и на клиенте лишний 403-запрос не шлём.
  const switchTherapistMode = (on: boolean, persist = true) => {
    localStorage.setItem('therapist_mode', on ? '1' : '0');
    setTherapistMode(on);
    if (persist && userRoleRef.current === 'THERAPIST') {
      api.setTherapistView(on).catch(() => {});
    }
  };
  // Отказ от роли терапевта → снова CLIENT: закрываем кабинет и переводим UI.
  const handleResignTherapist = useCallback(async () => {
    await api.resignTherapist();
    setUserRole('CLIENT');
    userRoleRef.current = 'CLIENT';
    switchTherapistMode(false, false);
    setCabinetView('list');
  }, []);
  const [cabinetView, setCabinetView] = useState<'list' | 'client'>('list');
  const therapistBackHandlerRef = useRef<() => void>(() =>
    setCabinetView('list'),
  );
  const [userRole, setUserRole] = useState<'CLIENT' | 'THERAPIST'>('CLIENT');
  const [roleLoaded, setRoleLoaded] = useState(false);
  // Один раз, когда И серверные флаги, И роль загружены, восстанавливаем
  // запомненный режим терапевта из серверного флага therapistMode (source of
  // truth — переживает стирание localStorage в Telegram WebView и синхронен
  // между устройствами). До этого момента показываем быстрый localStorage-хинт,
  // поэтому в типичном случае (флаг совпадает с localStorage) экран не моргает.
  const modeReconciledRef = useRef(false);
  useEffect(() => {
    if (modeReconciledRef.current || !flagsLoaded || !roleLoaded) return;
    modeReconciledRef.current = true;
    if (userRoleRef.current === 'THERAPIST') {
      const remembered = serverFlags.therapistMode;
      setTherapistMode(remembered);
      localStorage.setItem('therapist_mode', remembered ? '1' : '0');
    }
  }, [flagsLoaded, roleLoaded, serverFlags.therapistMode]);
  const safeTop = useSafeTop();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [helpTasks, setHelpTasks] = useState<UserTask[] | null>(null);
  const [helpTasksKey, setHelpTasksKey] = useState(0);
  const YSQ_BANNER_DISMISSED_KEY = 'ysq_banner_dismissed';
  const [_showYsqBanner, setShowYsqBanner] = useState(
    () =>
      !!localStorage.getItem(YSQ_PROGRESS_KEY) &&
      !localStorage.getItem(YSQ_RESULT_KEY) &&
      !localStorage.getItem('ysq_banner_dismissed'),
  );
  // Hide banner if server says it was already dismissed on another device
  useEffect(() => {
    if (serverFlags.ysqBannerDismissed) {
      setShowYsqBanner(false);
      localStorage.setItem(YSQ_BANNER_DISMISSED_KEY, '1');
    }
  }, [serverFlags.ysqBannerDismissed]);
  // Sync childhoodWheelDone from server → localStorage
  useEffect(() => {
    if (serverFlags.childhoodWheelDone)
      localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
  }, [serverFlags.childhoodWheelDone]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [yesterdayRatings, setYesterdayRatings] = useState<
    Record<string, number>
  >({});
  const [history, setHistory] = useState<DayHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Overlay states (open over current tab)
  const [newDiaryEntry, setNewDiaryEntry] = useState<
    'schema' | 'mode' | 'gratitude' | null
  >(null);
  const [diaryActiveSchemaIds, setDiaryActiveSchemaIds] = useState<
    string[] | undefined
  >(undefined);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      api.flushOutbox().catch(() => {});
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    // Флаш и при старте приложения — очередь могла накопиться в прошлой
    // сессии (webview закрылся до восстановления сети).
    api.flushOutbox().catch(() => {});
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    // Clear YSQ data from localStorage if it belongs to a different Telegram user.
    // Prevents a shared-device scenario where person B reads person A's clinical data.
    const currentUserId = String(
      window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? '',
    );
    if (currentUserId) {
      const storedUserId = localStorage.getItem('ysq_owner_id');
      if (storedUserId && storedUserId !== currentUserId) {
        localStorage.removeItem(YSQ_RESULT_KEY);
        localStorage.removeItem(YSQ_PROGRESS_KEY);
      }
      localStorage.setItem('ysq_owner_id', currentUserId);
    }
  }, []);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    window.Telegram?.WebApp?.disableVerticalSwipes?.();
    if (!sessionStorage.getItem('init_done')) {
      const tzOffset = Math.round(-new Date().getTimezoneOffset() / 60);
      api
        .init(tzOffset)
        .then(() => sessionStorage.setItem('init_done', '1'))
        .catch(() => {});
    }
    api.recordActivity().catch(() => {});
    const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];
    Promise.all(NEED_IDS.map((id) => api.getPractices(id)))
      .then((r) => setHelpPracticeCount(r.reduce((s, a) => s + a.length, 0)))
      .catch(() => setHelpPracticeCount(0));
    api
      .getPlanHistory(30)
      .then((p) => setHelpPlanCount(p.length))
      .catch(() => setHelpPlanCount(0));
    Promise.all([api.needs(), api.ratings(), api.ratings(YESTERDAY_DATE)])
      .then(([n, r, yR]) => {
        setNeeds(n);
        setRatings(r);
        setYesterdayRatings(yR);
        const initialSaved: Record<string, boolean> = {};
        for (const key of Object.keys(r)) initialSaved[key] = true;
        setSaved(initialSaved);
        if (n.length > 0 && n.every((need) => r[need.id] !== undefined)) {
          localStorage.setItem(TODAY_KEY, '1');
        }
        if (
          !yesterdayBannerDismissed &&
          HAS_HISTORY &&
          Object.keys(yR).length === 0
        ) {
          setShowYesterdayBanner(true);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    api
      .getPair()
      .then(setPairData)
      .catch((e) => console.error('getPair failed', e));
    api
      .getSettings()
      .then((s) => {
        setPairCardDismissed(s.pairCardDismissed);
        if (s.pairCardDismissed)
          localStorage.setItem('pair_card_dismissed', '1');
        else localStorage.removeItem('pair_card_dismissed');
        // Форма обращения ещё не выбрана — спросить ДО онбординга (не чаще раза
        // за сессию), чтобы весь онбординг звучал в выбранной форме.
        if (!s.addressForm && !sessionStorage.getItem('addr_form_asked')) {
          sheets.open('addressPicker');
        } else {
          onboarding.markAddressFormReady();
        }
      })
      .catch(() => {
        setPairCardDismissed(!!localStorage.getItem('pair_card_dismissed'));
        // Настройки не загрузились — не блокируем онбординг из-за формы.
        onboarding.markAddressFormReady();
      });
    api
      .getPendingPlans()
      .then(setPendingPlans)
      .catch((e) => console.error('getPendingPlans failed', e));
    api
      .getChildhoodRatings()
      .then((r) => {
        if (Object.keys(r).length > 0) {
          setChildhoodRatings(r);
          localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
          setServerFlag('childhoodWheelDone', true).catch(() => {});
        }
      })
      .catch((e) => console.error('getChildhoodRatings failed', e));
    Promise.all([api.getYsqProgress(), api.getYsqResult()])
      .then(([prog, result]) => {
        if (prog?.answers && !result?.answers) {
          localStorage.setItem(
            YSQ_PROGRESS_KEY,
            JSON.stringify({ answers: prog.answers, page: prog.page }),
          );
          if (!localStorage.getItem(YSQ_BANNER_DISMISSED_KEY))
            setShowYsqBanner(true);
        }
      })
      .catch(() => {});
    api
      .getProfile()
      .then((p) => {
        setDiaryActiveSchemaIds(p.ysq.activeSchemaIds);
        setUserRole(p.role);
        userRoleRef.current = p.role;
        setRoleLoaded(true);
        // Восстановление запомненного режима — в reconcile-эффекте (ждёт и
        // серверные флаги, и роль). Здесь только страховка: CLIENT никогда не
        // может быть в режиме терапевта.
        if (p.role !== 'THERAPIST') {
          switchTherapistMode(false, false);
        }
        if (p.name) setDisplayName(p.name);
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (p.role === 'THERAPIST') {
          cacheTherapistContact({
            role: 'THERAPIST',
            partnerId: null,
            partnerName: null,
            myId: tgUser?.id ?? null,
            myName: tgUser?.first_name ?? null,
          });
        } else {
          api
            .getTherapyRelation()
            .then((rel) => {
              cacheTherapistContact({
                role: 'CLIENT',
                partnerId: rel?.partnerId ?? null,
                partnerName: rel?.partnerName ?? null,
                myId: null,
                myName: null,
              });
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    api
      .getTasks()
      .then(setHelpTasks)
      .catch(() => setHelpTasks([]));
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (startParam?.startsWith('pair_')) {
      const code = startParam.replace('pair_', '');
      api
        .joinPair(code)
        .then(() =>
          api.getPair().then((data) => {
            setPairData(data);
            localStorage.removeItem('pair_card_dismissed');
            setPairCardDismissed(false);
            api.updateSettings({ pairCardDismissed: false }).catch(() => {});
          }),
        )
        .catch((e) => console.error('joinPair failed', e));
    }
    if (startParam === 'diaries') sheets.open('diaries');
    if (startParam === 'tracker') {
      sheets.open('trackerOverlay', { trackerNeedId: null });
    }
    if (startParam?.startsWith('therapy_')) {
      const code = startParam.replace('therapy_', '');
      api.joinTherapy(code).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (pairData && pairData.partners.length > 0) {
      localStorage.removeItem('pair_card_dismissed');
      setPairCardDismissed(false);
      api.updateSettings({ pairCardDismissed: false }).catch(() => {});
    }
  }, [pairData?.partners.length]);

  // Refresh Today section data after returning from overlays
  const prevOverlayRef = useRef(false);
  useEffect(() => {
    const anyOpen =
      sheets.trackerOverlay ||
      sheets.tracker ||
      sheets.diaries ||
      sheets.schemaInfo;
    if (!anyOpen && prevOverlayRef.current) setTodayRefreshKey((k) => k + 1);
    prevOverlayRef.current = anyOpen;
  }, [
    sheets.trackerOverlay,
    sheets.tracker,
    sheets.diaries,
    sheets.schemaInfo,
  ]);

  // Refresh Profile section data after returning from settings/practices/plans/tracker
  const prevProfileOverlayRef = useRef(false);
  useEffect(() => {
    const anyOpen =
      sheets.settings ||
      sheets.practices ||
      sheets.plans ||
      sheets.trackerOverlay ||
      sheets.tracker ||
      sheets.childhoodWheel;
    if (!anyOpen && prevProfileOverlayRef.current && section === 'profile') {
      setProfileRefreshKey((k) => k + 1);
    }
    prevProfileOverlayRef.current = anyOpen;
  }, [
    sheets.settings,
    sheets.practices,
    sheets.plans,
    sheets.trackerOverlay,
    sheets.tracker,
    sheets.childhoodWheel,
    section,
  ]);

  useEffect(() => {
    if (sheets.trackerTab === 'history') {
      setHistoryLoading(true);
      void api
        .history(historyDays)
        .then((h) => setHistory(fillHistoryGaps(h)))
        .finally(() => setHistoryLoading(false));
    }
  }, [sheets.trackerTab, historyDays]);

  // Telegram back button
  useTelegramBackButton({
    sheets,
    newDiaryEntry,
    setNewDiaryEntry,
    therapistMode,
    cabinetView,
    therapistBackHandlerRef,
    setPairData,
  });

  const anyOverlayOpen = !!(
    newDiaryEntry ||
    sheets.trackerOverlay ||
    sheets.tracker ||
    sheets.diaries ||
    sheets.schemaInfo ||
    sheets.settings ||
    sheets.practices ||
    sheets.plans ||
    sheets.about ||
    sheets.pairSheet ||
    sheets.childhoodWheel ||
    sheets.practicesOnboarding ||
    sheets.todayNote
  );

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeTouchRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleSwipeEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!swipeTouchRef.current || anyOverlayOpen) {
        swipeTouchRef.current = null;
        return;
      }
      const t = e.changedTouches[0];
      const dx = t.clientX - swipeTouchRef.current.x;
      const dy = t.clientY - swipeTouchRef.current.y;
      swipeTouchRef.current = null;
      if (Math.abs(dx) < 72 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      setSection((cur) => {
        const idx = SECTIONS.indexOf(cur);
        if (dx < 0 && idx < SECTIONS.length - 1) return SECTIONS[idx + 1];
        if (dx > 0 && idx > 0) return SECTIONS[idx - 1];
        return cur;
      });
    },
    [anyOverlayOpen],
  );

  const handleChange = useCallback((needId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [needId]: value }));
    setSaved((prev) => ({ ...prev, [needId]: false }));
  }, []);

  const handleSaved = useCallback((needId: string, streak?: StreakData) => {
    setSaved((prev) => ({ ...prev, [needId]: true }));
    if (streak && !localStorage.getItem(TODAY_KEY)) {
      localStorage.setItem(TODAY_KEY, '1');
      if (streak.currentStreak > 0) {
        setCelebrationStreak(streak.currentStreak);
      } else {
        sheets.open('todayNote');
      }
      if (streak.totalDays >= 5 && shouldShowChildhoodWheel()) {
        setChildhoodWheelPending(true);
      }
    }
  }, []);

  if (loading) {
    // Скелетон по форме будущего экрана вместо полноэкранного спиннера
    // (правило CLAUDE.md «Скелетоны, а не спиннеры»).
    return section === 'today' ? (
      <TodayScreenSkeleton />
    ) : (
      <ScreenSkeleton cards={section === 'profile' ? 4 : 3} />
    );
  }

  if (error) {
    return <AppErrorScreen error={error} />;
  }

  return (
    <div
      style={{ minHeight: '100vh', position: 'relative' }}
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
    >
      {/* Ambient gradient blobs — colors adapt per theme via CSS vars */}
      <AmbientBackground />
      <OfflineBanner isOffline={isOffline} />

      {/* ── Therapist app mode — full app replacement ── */}
      {therapistMode && (
        <>
          <TherapistClientSheet
            view={cabinetView}
            onViewChange={setCabinetView}
            onClose={() => {
              // Выход из кабинета запоминается (persist): приложение помнит
              // последний режим — при следующем входе откроется клиентский.
              switchTherapistMode(false);
              setCabinetView('list');
            }}
            backHandlerRef={therapistBackHandlerRef}
          />
          {/* Therapist bottom nav — replaces regular BottomNav */}
          {!sheets.settings && (
            <TherapistBottomNav
              onOpenSettings={() => sheets.open('settings')}
            />
          )}
        </>
      )}

      {/* ── Main sections (hidden when therapistMode) ── */}
      <AppSections
        therapistMode={therapistMode}
        section={section}
        setSection={setSection}
        needs={needs}
        ratings={ratings}
        yesterdayRatings={yesterdayRatings}
        sheets={sheets}
        todayRefreshKey={todayRefreshKey}
        userRole={userRole}
        setCabinetView={setCabinetView}
        switchTherapistMode={switchTherapistMode}
        childhoodRatings={childhoodRatings}
        helpPracticeCount={helpPracticeCount}
        helpPlanCount={helpPlanCount}
        helpTasks={helpTasks}
        helpTasksKey={helpTasksKey}
        setHelpTasks={setHelpTasks}
        setHelpTasksKey={setHelpTasksKey}
        profileRefreshKey={profileRefreshKey}
        displayName={displayName}
        onNewDiaryEntry={setNewDiaryEntry}
      />

      {/* ── История потребностей ── */}
      <TrackerHistoryOverlay
        sheets={sheets}
        safeTop={safeTop}
        needs={needs}
        history={history}
        historyLoading={historyLoading}
        setHistory={setHistory}
        setHistoryLoading={setHistoryLoading}
        ratings={ratings}
        childhoodRatings={childhoodRatings}
        pendingPlans={pendingPlans}
        setPendingPlans={setPendingPlans}
        historyDays={historyDays}
        showYesterdaySheet={showYesterdaySheet}
        setShowYesterdaySheet={setShowYesterdaySheet}
        backfillDate={backfillDate}
        setBackfillDate={setBackfillDate}
      />

      <AppOverlays
        sheets={sheets}
        needs={needs}
        ratings={ratings}
        saved={saved}
        isOffline={isOffline}
        onChange={handleChange}
        onSaved={handleSaved}
        yesterdayRatings={yesterdayRatings}
        showOnboarding={onboarding.visible}
        onAddressPickerDone={onboarding.markAddressFormReady}
        consentGiven={onboarding.consentGiven}
        onConsentDisclaimer={onboarding.persist}
        onAcceptDisclaimer={onboarding.accept}
        celebrationStreak={celebrationStreak}
        setCelebrationStreak={setCelebrationStreak}
        childhoodWheelPending={childhoodWheelPending}
        setChildhoodWheelPending={setChildhoodWheelPending}
        setChildhoodRatings={setChildhoodRatings}
        setPairData={setPairData}
        userRole={userRole}
        displayName={displayName}
        setDisplayName={setDisplayName}
        therapistMode={therapistMode}
        switchTherapistMode={switchTherapistMode}
        onResignTherapist={handleResignTherapist}
        diaryActiveSchemaIds={diaryActiveSchemaIds}
        newDiaryEntry={newDiaryEntry}
        setNewDiaryEntry={setNewDiaryEntry}
        section={section}
        setSection={setSection}
      />
    </div>
  );
}
