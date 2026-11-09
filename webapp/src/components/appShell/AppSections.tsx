// «Секции» AppShell (обычные разделы + кабинет терапевта) — вынесено из
// AppShell.tsx (правило №10, файл рос над потолком 300 строк). Рендерится
// внутри canvas как контейнер, соседний с оверлеями (Tracker/History/
// Diaries/AppOverlays/Celebration) — проп `inert` (выставляет AppShell, пока
// открыт хоть один из них) прячет весь этот блок от таба и скринридера:
// иначе фон читается сквозь оверлей (аудит 2026-09, находка — постоянный
// блок «Помощь рядом» в PracticeSection оставался доступным под каталогом
// практик). Сами оверлеи — вне этого компонента, поэтому inert их не трогает.
import { lazy, Suspense, useEffect, type MutableRefObject } from 'react';
import { useLocation, type NavigateFunction } from 'react-router-dom';
import { ErrorBoundary } from '../ErrorBoundary';
import { ScreenSkeleton } from '../Skeleton';
import type { Need } from '../../types';
import type { TherapyClientSummary, UserId } from '../../api';
import { leaveClientTarget, openClientRoute, type Section } from './navigation';
import { canonicalClientPath } from '../../../../shared/src/utils/clientRef';
import type { useOverlays } from './useOverlays';
const TodaySection    = lazy(() => import('../../sections/TodaySection').then(m => ({ default: m.TodaySection })));
const MoreSection    = lazy(() => import('../../sections/MoreSection').then(m => ({ default: m.MoreSection })));
const DiarySection    = lazy(() => import('../../sections/DiarySection').then(m => ({ default: m.DiarySection })));
const SchemasSection  = lazy(() => import('../../sections/SchemasSection').then(m => ({ default: m.SchemasSection })));
const ProfileSection  = lazy(() => import('../../sections/ProfileSection').then(m => ({ default: m.ProfileSection })));
const PracticeSection = lazy(() => import('../../sections/PracticeSection').then(m => ({ default: m.PracticeSection })));
const TherapistClientSheet  = lazy(() => import('../TherapistClientSheet').then(m => ({ default: m.TherapistClientSheet })));
const TherapistTodaySection = lazy(() => import('../../sections/TherapistTodaySection').then(m => ({ default: m.TherapistTodaySection })));
const TherapistGuideSection = lazy(() => import('../../sections/TherapistGuideSection').then(m => ({ default: m.TherapistGuideSection })));
// Разделы меню терапевта со своим экраном; любой другой /cabinet* — список клиентов или карточка.
const CABINET_PAGES = ['/cabinet/today', '/cabinet/guide'];

interface Props {
  inert: boolean;
  therapistMode: boolean;
  pathname: string;
  section: Section;
  needs: Need[];
  ratings: Record<string, number>;
  displayName: string | null;
  navigate: NavigateFunction;
  openClientRef: string | null; // код карточки или старый числовой id из адреса
  clients: TherapyClientSummary[];
  switchTherapistMode: (on: boolean, persist?: boolean) => void;
  therapistBackHandlerRef: MutableRefObject<() => void>;
  setTherapistClients: (clients: TherapyClientSummary[]) => void;
  setSection: (s: Section) => void;
  ov: ReturnType<typeof useOverlays>;
  todayRefreshKey: number;
  userRole: 'CLIENT' | 'THERAPIST';
  profileRefreshKey: number;
  childhoodRatings: Record<string, number>;
  helpTasksKey: number;
  setHelpTasksKey: (updater: (k: number) => number) => void;
}

export function AppSections({
  inert, therapistMode, pathname, section, needs, ratings,
  displayName, navigate, openClientRef, clients, switchTherapistMode, therapistBackHandlerRef,
  setTherapistClients, setSection, ov, todayRefreshKey, userRole, profileRefreshKey,
  childhoodRatings, helpTasksKey, setHelpTasksKey,
}: Props) {
  const { state: locState } = useLocation();
  const openClient = (id: UserId) => {
    const r = openClientRoute(pathname, id, clients);
    if (r) navigate(r.to, { state: r.state });
  };
  useEffect(() => { // старый числовой адрес карточки → код, без записи в истории; state — для «← Все клиенты»
    const to = canonicalClientPath(pathname, clients);
    if (to) navigate(to, { replace: true, state: locState });
  }, [pathname, clients, navigate, locState]);
  return (
    // display:contents — обёртка не участвует в flex-раскладке canvas
    // (.page/.main--cabinet контент остаётся прямым flex-ребёнком canvas),
    // существует только как узел DOM для inert.
    <div style={{ display: 'contents' }} inert={inert}>
    <Suspense fallback={<ScreenSkeleton />}>
    {/* Therapist mode */}
    {therapistMode && pathname === '/cabinet/today' && (
      <ErrorBoundary section="Кабинет" key="cabinet-today-boundary">
        {/* «Добавить клиента» у пустого кабинета — список, где форма открыта сразу. */}
        <TherapistTodaySection displayName={displayName} onOpenClient={openClient} onAddClient={() => navigate('/cabinet')} />
      </ErrorBoundary>
    )}
    {therapistMode && pathname === '/cabinet/guide' && (
      <ErrorBoundary section="Кабинет" key="cabinet-guide-boundary"><TherapistGuideSection /></ErrorBoundary>
    )}
    {therapistMode && !CABINET_PAGES.includes(pathname) && (
      <ErrorBoundary section="Кабинет" key="cabinet-client-boundary">
        <TherapistClientSheet
          view={openClientRef ? 'client' : 'list'}
          openClientRef={openClientRef}
          onViewChange={(v) => {
            if (v !== 'list') return;
            const to = leaveClientTarget(locState);
            if (to === -1) navigate(-1); else navigate(to);
          }}
          onOpenClient={openClient}
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
          <ErrorBoundary section="Сегодня" key="today-boundary">
          <TodaySection
            needs={needs}
            ratings={ratings}
            onOpenSchema={ov.openSchema}
            onOpenTracker={() => { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
            refreshKey={todayRefreshKey}
          />
          </ErrorBoundary>
        )}
        {section === 'diary' && (
          <ErrorBoundary section="Дневник" key="diary-boundary">
            <DiarySection onOpenTrackerHistory={() => { ov.setTrackerTab('history'); ov.setShowTracker(true); }} />
          </ErrorBoundary>
        )}
        {section === 'more' && (
          <ErrorBoundary section="Ещё" key="more-boundary">
            <MoreSection
              onNavigate={setSection}
              onOpenSchema={ov.openSchema}
              onOpenAdvanced={() => ov.setShowSettings(true)}
              onOpenTracker={() => { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
              onOpenDiaries={() => ov.setShowDiaries(true)}
              onOpenChildhoodWheel={() => ov.setShowChildhoodWheel(true)}
              refreshKey={todayRefreshKey}
              onTasksChanged={() => setHelpTasksKey(k => k + 1)}
              userRole={userRole}
              onOpenTherapistCabinet={() => { switchTherapistMode(true); }}
            />
          </ErrorBoundary>
        )}
        {section === 'schemas' && (
          <ErrorBoundary section="Паттерны" key="schemas-boundary">
            <SchemasSection
              onOpenSchema={ov.openSchema}
              childhoodRatings={childhoodRatings} onOpenSettings={() => ov.setShowSettings(true)}
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
            onTakeTest={() => ov.openSchema({ startTest: true })}
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
              onOpenSchema={ov.openSchema}
              refreshKey={helpTasksKey}
              onTasksChanged={() => setHelpTasksKey(k => k + 1)}
            />
          </ErrorBoundary>
        )}
      </div>
    )}
    </Suspense>
    </div>
  );
}
