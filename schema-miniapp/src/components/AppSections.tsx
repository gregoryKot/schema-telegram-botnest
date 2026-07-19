import { Need } from '../types';
import { api, UserTask } from '../api';
import { ErrorBoundary } from './ErrorBoundary';
import { Section } from './BottomNav';
import { TodaySection } from '../sections/TodaySection';
import { SchemasSection } from '../sections/SchemasSection';
import { HelpSection } from '../sections/HelpSection';
import { ProfileSection } from '../sections/ProfileSection';
import { UseSheetsReturn } from '../hooks/useSheets';

interface Props {
  therapistMode: boolean;
  section: Section;
  setSection: (s: Section) => void;
  needs: Need[];
  ratings: Record<string, number>;
  yesterdayRatings: Record<string, number>;
  sheets: UseSheetsReturn;
  todayRefreshKey: number;
  userRole: 'CLIENT' | 'THERAPIST';
  setCabinetView: (v: 'list' | 'client') => void;
  switchTherapistMode: (on: boolean) => void;
  childhoodRatings: Record<string, number>;
  helpPracticeCount: number | null;
  helpPlanCount: number | null;
  helpTasks: UserTask[] | null;
  helpTasksKey: number;
  setHelpTasks: (tasks: UserTask[]) => void;
  setHelpTasksKey: (updater: (k: number) => number) => void;
  profileRefreshKey: number;
  displayName: string | null;
  onNewDiaryEntry: (t: 'schema' | 'mode' | 'gratitude') => void;
}

// Четыре главных экрана (Сегодня/Паттерны/Помощь/Профиль). Перенесено из
// App.tsx как есть (этап 3 REMEDIATION_PLAN) — без смены поведения.
export function AppSections({
  therapistMode,
  section,
  setSection,
  needs,
  ratings,
  yesterdayRatings,
  sheets,
  todayRefreshKey,
  userRole,
  setCabinetView,
  switchTherapistMode,
  childhoodRatings,
  helpPracticeCount,
  helpPlanCount,
  helpTasks,
  helpTasksKey,
  setHelpTasks,
  setHelpTasksKey,
  profileRefreshKey,
  displayName,
  onNewDiaryEntry,
}: Props) {
  return (
    <>
      {!therapistMode && section === 'today' && (
        <ErrorBoundary section="Сегодня" key="today-boundary">
          <TodaySection
            needs={needs}
            ratings={ratings}
            yesterdayRatings={yesterdayRatings}
            onNavigate={setSection}
            onOpenSchema={(opts) => {
              sheets.open('schemaInfo', {
                schemaAutoStartTest: !!opts?.startTest,
                schemaInitialTab: opts?.tab ?? 'needs',
                schemaHighlight: opts?.highlight,
              });
            }}
            onOpenAdvanced={() => sheets.open('settings')}
            onOpenTracker={() => {
              sheets.open('trackerOverlay', { trackerNeedId: null });
            }}
            onOpenTrackerAt={(needId) => {
              sheets.open('trackerOverlay', { trackerNeedId: needId });
            }}
            onOpenTrackerHistory={() => {
              sheets.open('tracker', { trackerTab: 'history' });
            }}
            onOpenDiaries={() => sheets.open('diaries')}
            onOpenChildhoodWheel={() => sheets.open('childhoodWheel')}
            refreshKey={todayRefreshKey}
            userRole={userRole}
            onOpenTherapistCabinet={() => {
              setCabinetView('list');
              switchTherapistMode(true);
            }}
            onNewDiaryEntry={onNewDiaryEntry}
          />
        </ErrorBoundary>
      )}

      {!therapistMode && section === 'schemas' && (
        <ErrorBoundary section="Паттерны" key="schemas-boundary">
          <SchemasSection
            onOpenSchema={(opts) => {
              sheets.open('schemaInfo', {
                schemaAutoStartTest: !!opts?.startTest,
                schemaInitialTab: opts?.tab ?? 'needs',
                schemaHighlight: opts?.highlight,
              });
            }}
            childhoodRatings={childhoodRatings}
            onOpenChildhoodWheel={() => sheets.open('childhoodWheel')}
            onOpenDiaries={() => sheets.open('diaries')}
          />
        </ErrorBoundary>
      )}

      {!therapistMode && section === 'help' && (
        <ErrorBoundary section="Помощь" key="help-boundary">
          <HelpSection
            onOpenChildhoodWheel={() => sheets.open('childhoodWheel')}
            onOpenPractices={() => sheets.open('practices')}
            onOpenPlans={() => sheets.open('plans')}
            onOpenTracker={() => {
              sheets.open('trackerOverlay', { trackerNeedId: null });
            }}
            onOpenDiaries={() => sheets.open('diaries')}
            practiceCount={helpPracticeCount}
            planCount={helpPlanCount}
            initialTasks={helpTasks}
            refreshKey={helpTasksKey}
            onTasksChanged={() => {
              api
                .getTasks()
                .then(setHelpTasks)
                .catch(() => {});
              setHelpTasksKey((k) => k + 1);
            }}
            userRole={userRole}
            onOpenTherapistCabinet={() => {
              setCabinetView('list');
              switchTherapistMode(true);
            }}
          />
        </ErrorBoundary>
      )}

      {!therapistMode && section === 'profile' && (
        <ErrorBoundary section="Профиль" key="profile-boundary">
          <ProfileSection
            onOpenSettings={() => sheets.open('settings')}
            onOpenTracker={() => {
              sheets.open('trackerOverlay', { trackerNeedId: null });
            }}
            refreshKey={profileRefreshKey}
            displayName={displayName}
          />
        </ErrorBoundary>
      )}
    </>
  );
}
