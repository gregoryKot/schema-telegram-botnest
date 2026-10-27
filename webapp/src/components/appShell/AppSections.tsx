// «Секции» AppShell (обычные разделы + кабинет терапевта) — вынесено из
// AppShell.tsx (правило №10, файл рос над потолком 300 строк). Рендерится
// внутри canvas как контейнер, соседний с оверлеями (Tracker/History/
// Diaries/AppOverlays/Celebration) — проп `inert` (выставляет AppShell, пока
// открыт хоть один из них) прячет весь этот блок от таба и скринридера:
// иначе фон читается сквозь оверлей (аудит 2026-09, находка — постоянный
// блок «Помощь рядом» в PracticeSection оставался доступным под каталогом
// практик). Сами оверлеи — вне этого компонента, поэтому inert их не трогает.
import { lazy, Suspense, type MutableRefObject } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ErrorBoundary } from '../ErrorBoundary';
import { ScreenSkeleton } from '../Skeleton';
import type { Need } from '../../types';
import type { TherapyClientSummary, UserId } from '../../api';
import type { Section } from './navigation';
import type { useOverlays } from './useOverlays';
const TodaySection    = lazy(() => import('../../sections/TodaySection').then(m => ({ default: m.TodaySection })));
const MoreSection    = lazy(() => import('../../sections/MoreSection').then(m => ({ default: m.MoreSection })));
const DiarySection    = lazy(() => import('../../sections/DiarySection').then(m => ({ default: m.DiarySection })));
const SchemasSection  = lazy(() => import('../../sections/SchemasSection').then(m => ({ default: m.SchemasSection })));
const ProfileSection  = lazy(() => import('../../sections/ProfileSection').then(m => ({ default: m.ProfileSection })));
const PracticeSection = lazy(() => import('../../sections/PracticeSection').then(m => ({ default: m.PracticeSection })));
const TherapistClientSheet  = lazy(() => import('../TherapistClientSheet').then(m => ({ default: m.TherapistClientSheet })));
const TherapistTodaySection = lazy(() => import('../../sections/TherapistTodaySection').then(m => ({ default: m.TherapistTodaySection })));

interface Props {
  inert: boolean;
  therapistMode: boolean;
  pathname: string;
  section: Section;
  needs: Need[];
  ratings: Record<string, number>;
  displayName: string | null;
  navigate: NavigateFunction;
  openClientId: UserId | null;
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
  displayName, navigate, openClientId, switchTherapistMode, therapistBackHandlerRef,
  setTherapistClients, setSection, ov, todayRefreshKey, userRole, profileRefreshKey,
  childhoodRatings, helpTasksKey, setHelpTasksKey,
}: Props) {
  return (
    // display:contents — обёртка не участвует в flex-раскладке canvas
    // (.page/.main--cabinet контент остаётся прямым flex-ребёнком canvas),
    // существует только как узел DOM для inert.
    <div style={{ display: 'contents' }} inert={inert}>
    <Suspense fallback={<ScreenSkeleton />}>
    {/* Therapist mode */}
    {therapistMode && pathname === '/cabinet/today' && (
      <ErrorBoundary section="Кабинет" key="cabinet-today-boundary">
        <TherapistTodaySection
          displayName={displayName}
          onOpenClient={(id) => navigate('/cabinet/' + id)}
        />
      </ErrorBoundary>
    )}
    {therapistMode && pathname !== '/cabinet/today' && (
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
          <ErrorBoundary section="Сегодня" key="today-boundary">
          <TodaySection
            needs={needs}
            ratings={ratings}
            onNavigate={setSection}
            onOpenSchema={(opts) => { ov.setSchemaAutoStartTest(!!opts?.startTest); ov.setSchemaInitialTab(opts?.tab ?? 'needs'); ov.setSchemaHighlight(opts?.highlight); ov.setShowSchemaInfo(true); }}
            onOpenAdvanced={() => ov.setShowSettings(true)}
            onOpenTracker={() => { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
            onOpenTrackerHistory={() => { ov.setTrackerTab('history'); ov.setShowTracker(true); }}
            onOpenDiaries={() => ov.setShowDiaries(true)}
            onOpenChildhoodWheel={() => ov.setShowChildhoodWheel(true)}
            refreshKey={todayRefreshKey}
            onTasksChanged={() => setHelpTasksKey(k => k + 1)}
          />
          </ErrorBoundary>
        )}
        {section === 'diary' && (
          <ErrorBoundary section="Дневник" key="diary-boundary">
            <DiarySection onOpenTracker={() => { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }} />
          </ErrorBoundary>
        )}
        {section === 'more' && (
          <ErrorBoundary section="Ещё" key="more-boundary">
            <MoreSection
              onNavigate={setSection}
              onOpenSchema={(opts) => { ov.setSchemaAutoStartTest(!!opts?.startTest); ov.setSchemaInitialTab('needs'); ov.setSchemaHighlight(undefined); ov.setShowSchemaInfo(true); }}
              onOpenAdvanced={() => ov.setShowSettings(true)}
              userRole={userRole}
              onOpenTherapistCabinet={() => { switchTherapistMode(true); }}
            />
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
            onTakeTest={() => { ov.setSchemaAutoStartTest(true); ov.setSchemaInitialTab('needs'); ov.setShowSchemaInfo(true); }}
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
    </div>
  );
}
