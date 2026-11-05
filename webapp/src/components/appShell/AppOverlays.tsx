// «Полноэкранные» шторки AppShell (настройки, практики, планы, справочник
// схем, колесо детства, заметка дня, цель трекера, дисклеймер кабинета) —
// вынесено из AppShell.tsx (правило №10, файл был на потолке 300 строк).
// Каждая шторка — своя Suspense-граница с fallback={null}: контент под ней
// (раздел/кабинет) остаётся смонтированным отдельной Suspense-границей в
// AppShell, поэтому пока качается чанк шторки — ничего не появляется поверх,
// без мигания пустым экраном (аудит 2026-08-22, находка №1).
import { lazy, Suspense } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { api } from '../../api';
import { cacheTherapistMode } from './therapistModeCache';
import { markTherapistDisclaimerSeen } from '../therapistDisclaimerSeen';
import type { useOverlays } from './useOverlays';
import { NoteSheet } from '../NoteSheet';

const SettingsSheet   = lazy(() => import('../SettingsSheet').then(m => ({ default: m.SettingsSheet })));
const PracticesScreen = lazy(() => import('../PracticesScreen').then(m => ({ default: m.PracticesScreen })));
const PlansScreen     = lazy(() => import('../PlansScreen').then(m => ({ default: m.PlansScreen })));
const SchemaInfoSheet = lazy(() => import('../SchemaInfoSheet').then(m => ({ default: m.SchemaInfoSheet })));
const ChildhoodWheelEx = lazy(() => import('../exercises/ChildhoodWheelEx').then(m => ({ default: m.ChildhoodWheelEx })));
const SchemaFlashcard = lazy(() => import('../SchemaFlashcard').then(m => ({ default: m.SchemaFlashcard })));
const TherapistPrivacyDisclaimer = lazy(() => import('../TherapistPrivacyDisclaimer').then(m => ({ default: m.TherapistPrivacyDisclaimer })));

export function AppOverlays({
  ov, userRole, setUserRole, displayName, setDisplayName, therapistMode, switchTherapistMode,
  navigate, ratings, setChildhoodRatings, childhoodWheelPending, setChildhoodWheelPending, todayDate,
}: {
  ov: ReturnType<typeof useOverlays>;
  userRole: 'CLIENT' | 'THERAPIST';
  setUserRole: (r: 'CLIENT' | 'THERAPIST') => void;
  displayName: string | null;
  setDisplayName: (n: string | null) => void;
  therapistMode: boolean;
  switchTherapistMode: (on: boolean, persist?: boolean) => void;
  navigate: NavigateFunction;
  ratings: Record<string, number>;
  setChildhoodRatings: (r: Record<string, number>) => void;
  childhoodWheelPending: boolean;
  setChildhoodWheelPending: (v: boolean) => void;
  todayDate: string;
}) {
  return (<>
    {ov.showSettings && (
      <Suspense fallback={null}>
        <SettingsSheet
          onClose={() => ov.setShowSettings(false)}
          userRole={userRole}
          displayName={displayName}
          onNameChanged={setDisplayName}
          onOpenTherapistCabinet={() => { ov.setShowSettings(false); navigate('/cabinet'); }}
          therapistMode={therapistMode}
          onSetTherapistMode={(on) => switchTherapistMode(on)}
          onResignTherapist={async () => {
            await api.resignTherapist();
            setUserRole('CLIENT');
            cacheTherapistMode(false);
            ov.setShowSettings(false); navigate('/today');
          }}
        />
      </Suspense>
    )}
    {ov.showPractices && (
      <Suspense fallback={null}>
        <PracticesScreen
          onClose={() => ov.setShowPractices(false)}
          onOpenTracker={() => { ov.setShowPractices(false); ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
        />
      </Suspense>
    )}
    {ov.showPlans && (
      <Suspense fallback={null}>
        <PlansScreen
          onClose={() => ov.setShowPlans(false)}
          onOpenTracker={() => { ov.setShowPlans(false); ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
        />
      </Suspense>
    )}
    {ov.showSchemaInfo && (
      <Suspense fallback={null}>
        <SchemaInfoSheet
          onClose={() => { ov.setShowSchemaInfo(false); ov.setSchemaAutoStartTest(false); ov.setSchemaHighlight(undefined); }}
          ratings={ratings}
          autoStartTest={ov.schemaAutoStartTest}
          initialTab={ov.schemaInitialTab}
          highlightSchema={ov.schemaHighlight}
        />
      </Suspense>
    )}
    {ov.showChildhoodWheel && (
      <div className="u-sheet">
        <Suspense fallback={null}>
          <ChildhoodWheelEx
            onBack={() => ov.setShowChildhoodWheel(false)}
            onSaved={(r) => setChildhoodRatings(r)}
            onOpenSchemas={() => { ov.setShowChildhoodWheel(false); ov.openSchema({ tab: 'schemas' }); }}
          />
        </Suspense>
      </div>
    )}
    {ov.showTodayNote && (
      <NoteSheet date={todayDate} onClose={() => {
        ov.setShowTodayNote(false);
        if (childhoodWheelPending) { setChildhoodWheelPending(false); ov.setShowChildhoodWheel(true); }
      }} />
    )}
    {/* «Мне плохо» открывается поверх раздела, где человек был: «Назад» браузера
        возвращает туда же, а не на /practice (QA 2026-11, A-М10). */}
    {ov.showSosCard && (
      <Suspense fallback={null}>
        <SchemaFlashcard
          onClose={() => ov.setShowSosCard(false)}
          onOpenTracker={() => { ov.setShowSosCard(false); ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }}
        />
      </Suspense>
    )}
    {ov.showTherapistDisclaimer && (
      <Suspense fallback={null}>
        <TherapistPrivacyDisclaimer onDone={() => {
          // Persist on ANY close path (button OR browser-back), otherwise a
          // back-button dismissal leaves the flag unset and the disclaimer
          // re-shows on every entry into the therapist cabinet.
          markTherapistDisclaimerSeen(); ov.setShowTherapistDisclaimer(false);
        }} />
      </Suspense>
    )}
  </>);
}
