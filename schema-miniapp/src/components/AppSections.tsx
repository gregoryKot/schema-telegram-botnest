import { useEffect } from 'react';
import { Need } from '../types';
import { api, UserTask } from '../api';
import { ErrorBoundary } from './ErrorBoundary';
import { Section } from './BottomNav';
import {
  LazyTodaySection as TodaySection,
  LazySchemasSection as SchemasSection,
  LazyHelpSection as HelpSection,
  LazyProfileSection as ProfileSection,
} from './LazySections';
import { UseSheetsReturn } from '../hooks/useSheets';
import { KeepMountedSection } from './KeepMountedSection';

interface Props {
  /** Вкладки, собранные заранее в простое (usePrerenderSections) — их
   *  KeepMountedSection монтирует скрытыми до первого тапа. */
  prerenderedSections: Set<Section>;
  therapistMode: boolean;
  section: Section;
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
  onStartCase: () => void;
  onOpenMap: () => void;
  onSteadyDay: () => void;
  /** null = нет ожидающего явного перехода — SchemasSection сам решает
   *  вкладку (последняя открытая, см. patternsTabStorage.ts). */
  patternsTab: 'schemas' | 'modes' | null;
  onOpenPatterns: (tab: 'schemas' | 'modes') => void;
}

// Четыре главных экрана (Сегодня/Паттерны/Помощь/Профиль). Однажды
// открытая вкладка держится смонтированной (KeepMountedSection) — тап
// переключает видимость, а не перестраивает экран (замер 2026-08-24:
// перемонтирование стоило ~100мс мёртвых + мигание + тяжёлый коммит на
// каждом переключении; см. комментарий в KeepMountedSection.tsx).
export function AppSections({
  prerenderedSections,
  therapistMode,
  section,
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
  patternsTab,
  onOpenPatterns,
  onStartCase,
  onOpenMap,
  onSteadyDay,
}: Props) {
  // Раньше возврат к верху происходил сам: перемонтирование секции схлопывало
  // высоту страницы. Секции больше не перемонтируются — скроллим явно.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section]);
  return (
    <>
      <KeepMountedSection
        active={!therapistMode && section === 'today'}
        prerender={prerenderedSections.has('today')}
      >
        {
          <ErrorBoundary section="Сегодня" key="today-boundary">
            <TodaySection
              needs={needs}
              ratings={ratings}
              yesterdayRatings={yesterdayRatings}
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
              onStartCase={onStartCase}
              onOpenMap={onOpenMap}
              onSteadyDay={onSteadyDay}
            />
          </ErrorBoundary>
        }
      </KeepMountedSection>

      <KeepMountedSection
        active={!therapistMode && section === 'schemas'}
        prerender={prerenderedSections.has('schemas')}
      >
        {
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
              initialTab={patternsTab ?? undefined}
            />
          </ErrorBoundary>
        }
      </KeepMountedSection>

      <KeepMountedSection
        active={!therapistMode && section === 'help'}
        prerender={prerenderedSections.has('help')}
      >
        {
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
                  .catch((e) => console.error('getTasks failed', e));
                setHelpTasksKey((k) => k + 1);
              }}
              userRole={userRole}
              onOpenTherapistCabinet={() => {
                setCabinetView('list');
                switchTherapistMode(true);
              }}
            />
          </ErrorBoundary>
        }
      </KeepMountedSection>

      <KeepMountedSection
        active={!therapistMode && section === 'profile'}
        prerender={prerenderedSections.has('profile')}
      >
        {
          <ErrorBoundary section="Я" key="profile-boundary">
            <ProfileSection
              onOpenSettings={() => sheets.open('settings')}
              onOpenTracker={() => {
                sheets.open('trackerOverlay', { trackerNeedId: null });
              }}
              refreshKey={profileRefreshKey}
              displayName={displayName}
              onOpenPatterns={onOpenPatterns}
            />
          </ErrorBoundary>
        }
      </KeepMountedSection>
    </>
  );
}
