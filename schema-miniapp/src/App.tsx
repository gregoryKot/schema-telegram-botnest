import { useEffect, useState, useCallback, useRef } from 'react';
import { getHost } from '../../shared/src/host';
import { shouldAskAddressForm } from '../../shared/src/settings/addressFormPrompt';
import { useUserFlags, setFlag as setServerFlag } from './useUserFlags';
import { applyTheme, getTheme } from './utils/theme';
import { syncMotionAttr } from './utils/reducedMotion';
import { Need, DayHistory } from './types';

// Apply saved theme immediately before first render
applyTheme(getTheme());
syncMotionAttr();
import { api, PracticePlan, PairsData, StreakData, UserTask } from './api';
import { DEFAULT_SECTION_KEY } from './utils/defaultSectionKey';
import { Section } from './components/BottomNav';
import { LazyTherapistClientSheet as TherapistClientSheet } from './components/LazyTherapistClientSheet';
import { TodayScreenSkeleton, ScreenSkeleton } from './components/Skeleton';
import { shouldShowWeeklyQuestion } from './components/WeeklyQuestion';
// CHILDHOOD_DONE_KEY/shouldShowChildhoodWheel/YSQ_*_KEY — из общего реестра
// ключей (утиль, не компонент), НЕ из ChildhoodWheelSheet.tsx/YSQTestSheet.tsx
// (правка производительности 2026-08-22): те стали ленивыми (LazyOverlays.tsx),
// и статический импорт значений из них держал бы весь их код в графе,
// реально достижимом от entry — React.lazy не смог бы вынести компонент в
// отдельный чанк (см. предупреждение сборки [INEFFECTIVE_DYNAMIC_IMPORT]).
import {
  shouldShowChildhoodWheel,
  CHILDHOOD_DONE_KEY,
  YSQ_PROGRESS_KEY,
  YSQ_RESULT_KEY,
} from './utils/storageKeys';
import { useSafeTop } from './utils/safezone';
import { cacheTherapistContact } from './utils/therapistContact';
import { useSheets } from './hooks/useSheets';
import { useHostBackButton } from './hooks/useHostBackButton';
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
import { preloadOtherSections } from './utils/preloadSections';
import { prefetchOtherSectionsData } from './utils/prefetchSectionData';
import { usePrerenderSections } from './utils/usePrerenderSections';
import { usePerfTapTracking } from './utils/usePerfTapTracking';
import { preloadDiarySheets } from './components/LazyDiarySheets';
import { AppErrorScreen } from './components/AppErrorScreen';
import { LoginScreen } from './components/LoginScreen';
import { AmbientBackground } from './components/AmbientBackground';
import { OfflineBanner } from './components/OfflineBanner';
import { useOnboardingGate } from './hooks/useOnboardingGate';
import { useSectionSwipe } from './hooks/useSectionSwipe';
import { useSessionExpired } from './hooks/useSessionExpired';
import { shouldShowLoginScreen } from './utils/loginScreenGate';
import { ensureSession, SESSION_EXPIRED_ERROR } from './session';
import { syncFromServer } from './utils/uiPrefsSync';
import { logErr } from './utils/logErr';

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
  const { flags: serverFlags, loadedFromServer: flagsLoaded } = useUserFlags();
  const [section, setSection] = useState<Section>(getInitialSection);
  // Догружаем секции, которые пользователь не открыл первыми, в простое
  // браузера — переключение вкладок остаётся мгновенным (см. preloadSections.ts,
  // замер 2026-08-22: единый стартовый чанк — 1,26 МБ, 2,3 c до первого
  // рендера на 3G). Только начальная секция важна — она уже грузится сама
  // (React.lazy в AppSections.tsx), дальнейшая смена вкладки эту догрузку
  // не перезапускает. Та же идея для ДАННЫХ чужих вкладок — prefetchSectionData.ts.
  useEffect(() => {
    preloadOtherSections(section);
    // Только при маунте: начальная секция за жизнь компонента не меняется,
    // повторный запуск плана на каждую смену вкладки не нужен.
  }, []);
  // Сессия умерла посреди работы (initData протухла, перевыпуск не удался) —
  // экран обязан сказать об этом, а не молча проглатывать 401 (правило
  // «никаких молча неработающих экранов», инцидент 2026-07-29).
  const sessionExpired = useSessionExpired();
  // Первый вход (онбординг + согласие) целиком в хуке — см. useOnboardingGate.
  const onboarding = useOnboardingGate(
    serverFlags.onboardingV2Done,
    flagsLoaded,
  );
  const historyDays = 30;
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
  // Вкладка «Паттернов» при явном переходе с карточки «Мой портрет». null =
  // нет ожидающего перехода — SchemasSection сам берёт последнюю открытую
  // (patternsTabStorage.ts). Эффект гасит запрос сразу после того, как
  // SchemasSection его подхватил (initialTab читается один раз при
  // монтировании) — иначе обычный заход через нижнюю навигацию снова
  // приносил бы старую явную вкладку вместо реально последней.
  const [patternsTab, setPatternsTab] = useState<'schemas' | 'modes' | null>(
    null,
  );
  useEffect(() => {
    if (patternsTab !== null) setPatternsTab(null);
  }, [patternsTab]);
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
  // true после первого ручного переключения режима — реконсиляция ниже
  // тогда не смеет перетирать выбор серверным флагом.
  const userToggledModeRef = useRef(false);
  // persist=true — запомнить режим на сервере (localStorage в Telegram WebView
  // стирается). Сервер принимает флаг только у THERAPIST — на клиенте лишний
  // 403-запрос не шлём.
  const switchTherapistMode = (on: boolean, persist = true) => {
    // Ручной выбор сильнее поздней реконсиляции из серверного флага: без
    // этого терапевт, включивший режим в первые секунды (пока флаги ещё
    // едут по сети), получал молчаливый откат — поздний эффект ниже
    // перетирал его клик значением с сервера (реальное падение CI
    // 2026-08-24, гонка воспроизводима на медленной сети).
    userToggledModeRef.current = true;
    localStorage.setItem('therapist_mode', on ? '1' : '0');
    setTherapistMode(on);
    if (persist && userRoleRef.current === 'THERAPIST') {
      api.setTherapistView(on).catch(logErr('setTherapistView'));
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
  // Один раз, когда И серверные флаги, И роль загружены, восстанавливаем режим
  // терапевта из серверного флага (переживает стирание localStorage в Telegram
  // WebView). До этого — быстрый localStorage-хинт, экран обычно не моргает.
  const modeReconciledRef = useRef(false);
  useEffect(() => {
    if (modeReconciledRef.current || !flagsLoaded || !roleLoaded) return;
    modeReconciledRef.current = true;
    // Пользователь уже переключил режим руками за время загрузки флагов —
    // его выбор не перетираем (см. switchTherapistMode выше).
    if (userToggledModeRef.current) return;
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
  // Прогрев ДАННЫХ чужих вкладок и чанков дневниковых шитов — только когда
  // данные первого экрана уже приехали (loading=false). Прогрев с маунта
  // толкался с needs/ratings и чанком TodaySection за канал: замер
  // 2026-08-23, холодный старт 3G 4044 → 4398мс. Idle-колбэк не защищает —
  // он про простой ПРОЦЕССОРА, а узкое место здесь сеть.
  // Третий ярус прогрева: скрытая сборка чужих вкладок в простое (код и
  // данные уже тёплые — см. эффект ниже), чтобы и ПЕРВЫЙ тап по вкладке был
  // переключением видимости, а не тяжёлым коммитом (usePrerenderSections).
  const prerenderedSections = usePrerenderSections(!loading, section);
  // Замер «тап по вкладке → отрисовка» для панели PerfHud (см. perfLog.ts).
  usePerfTapTracking(section, prerenderedSections, loading);
  const prefetchStarted = useRef(false);
  useEffect(() => {
    if (loading || prefetchStarted.current) return;
    prefetchStarted.current = true;
    prefetchOtherSectionsData(section, setHelpPracticeCount);
    // Дневниковые шиты («+») ленивые (LazyDiarySheets.tsx) — их чанки
    // догружаются той же idle-очередью, чтобы первое нажатие «+» не ждало сеть.
    preloadDiarySheets();
  }, [loading]);
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
      api.flushOutbox().catch(logErr('flushOutbox'));
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    // Флаш и при старте приложения — очередь могла накопиться в прошлой
    // сессии (webview закрылся до восстановления сети).
    api.flushOutbox().catch(logErr('flushOutbox'));
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    // Clear YSQ data from localStorage if it belongs to a different user.
    // Prevents a shared-device scenario where person B reads person A's clinical data.
    const currentUserId = getHost().user()?.id ?? '';
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
    getHost().ready();
    getHost().expand();
    // Меняем свежую подпись хоста на сессию — фоном, запросы её не ждут. Через
    // час Telegram ту же initData не обновит, и без этой куки приложение умирало.
    void ensureSession();
    if (!sessionStorage.getItem('init_done')) {
      const tzOffset = Math.round(-new Date().getTimezoneOffset() / 60);
      api
        .init(tzOffset)
        .then(() => sessionStorage.setItem('init_done', '1'))
        .catch(logErr('api.init'));
    }
    api.recordActivity().catch(logErr('recordActivity'));
    // getPractices×5 (бейдж «Помощи») — не первому рендеру «Сегодня»,
    // перенесён в prefetchOtherSectionsData (эффект выше).
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
        // uiPrefsSync: миграция/server-wins кастомизации (подхватится следующим маунтом вкладки).
        syncFromServer(s.uiPrefs);
        // Форма обращения ещё не выбрана — спросить ДО онбординга, чтобы весь
        // онбординг звучал в выбранной форме. «Позже» откладывает на неделю
        // (shared/settings/addressFormPrompt), а не на одну вкладку.
        if (shouldAskAddressForm(s.addressForm)) {
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
          setServerFlag('childhoodWheelDone', true).catch(logErr('cwDone'));
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
      .catch(logErr('getYsqProgress/getYsqResult'));
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
        const hostUser = getHost().user();
        if (p.role === 'THERAPIST') {
          cacheTherapistContact({
            role: 'THERAPIST',
            partnerId: null,
            partnerName: null,
            // Ссылка на терапевта — tg://user?id=…, отсюда только числовой
            // идентификатор: у другой площадки будет своя ссылка на профиль.
            myId: hostUser ? Number(hostUser.id) || null : null,
            myName: hostUser?.firstName ?? null,
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
            .catch(logErr('getTherapyRelation'));
        }
      })
      .catch(logErr('getProfile'));
    api
      .getTasks()
      .then(setHelpTasks)
      .catch(() => setHelpTasks([]));
    const startParam = getHost().startParam();
    // M1 (аудит 2026-08): startParam подконтролен атакующему (?startapp=…), а
    // pair_/therapy_ — приватные state-changing присоединения (партнёр видит
    // оценки и историю; терапевт — клинику). Молча джойнить на маунте нельзя —
    // сначала явное согласие (JoinConfirmSheet), джойн только после него.
    if (startParam?.startsWith('pair_')) {
      sheets.open('joinConfirm', {
        joinKind: 'pair',
        joinCode: startParam.slice('pair_'.length),
      });
    } else if (startParam?.startsWith('therapy_')) {
      sheets.open('joinConfirm', {
        joinKind: 'therapy',
        joinCode: startParam.slice('therapy_'.length),
      });
    }
    if (startParam === 'diaries') sheets.open('diaries');
    if (startParam === 'tracker') {
      sheets.open('trackerOverlay', { trackerNeedId: null });
    }
  }, []);

  useEffect(() => {
    if (pairData && pairData.partners.length > 0) {
      localStorage.removeItem('pair_card_dismissed');
      setPairCardDismissed(false);
      api.updateSettings({ pairCardDismissed: false }).catch(logErr('upd'));
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

  // Кнопка «назад» хоста (Telegram/MAX) или истории браузера (web)
  useHostBackButton({
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
    sheets.todayNote
  );

  const swipe = useSectionSwipe({
    sections: SECTIONS,
    setSection,
    disabled: anyOverlayOpen,
  });

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

  if (error || sessionExpired) {
    // В браузере отсутствие сессии значит «не входил», а не «истекла» —
    // рисуем экран входа. В Telegram/MAX поведение прежнее (см.
    // utils/loginScreenGate.ts).
    if (sessionExpired && shouldShowLoginScreen()) return <LoginScreen />;
    return (
      <AppErrorScreen error={sessionExpired ? SESSION_EXPIRED_ERROR : error!} />
    );
  }

  return (
    <div
      style={{ minHeight: '100vh', position: 'relative' }}
      onTouchStart={swipe.onTouchStart}
      onTouchEnd={swipe.onTouchEnd}
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
        prerenderedSections={prerenderedSections}
        therapistMode={therapistMode}
        section={section}
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
        patternsTab={patternsTab}
        onOpenPatterns={(tab) => {
          setPatternsTab(tab);
          setSection('schemas');
        }}
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
