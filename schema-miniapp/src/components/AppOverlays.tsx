import { Need } from '../types';
import { api, PairsData, StreakData } from '../api';
import { DiarySection } from '../sections/DiarySection';
import { Section } from './BottomNav';
import { TrackerOverlay } from './TrackerOverlay';
import { Disclaimer } from './Disclaimer';
import { SettingsSheet } from './SettingsSheet';
import { AddressFormPicker } from './AddressFormPicker';
import { DonateNudge } from './DonateNudge';
import { PracticesScreen } from './PracticesScreen';
import { PlansScreen } from './PlansScreen';
import { Celebration } from './Celebration';
import { todayInsightPhrase } from '../utils/todayInsight';
import { NoteSheet } from './NoteSheet';
import { SchemaInfoSheet } from './SchemaInfoSheet';
import { PairSheet } from './PairSheet';
import { PracticesOnboarding } from './PracticesOnboarding';
import { ChildhoodWheelSheet } from './ChildhoodWheelSheet';
import { TaskCreateSheet } from './TaskCreateSheet';
import { AboutSheet } from './AboutSheet';
import { AppDiaryNav } from './AppDiaryNav';
import { UseSheetsReturn } from '../hooks/useSheets';
import { TODAY_DATE } from '../utils/todayConstants';

interface Props {
  sheets: UseSheetsReturn;
  needs: Need[];
  ratings: Record<string, number>;
  saved: Record<string, boolean>;
  isOffline: boolean;
  onChange: (needId: string, value: number) => void;
  onSaved: (needId: string, streak?: StreakData) => void;
  yesterdayRatings: Record<string, number>;
  onboardingSeen: boolean;
  addressFormReady: boolean;
  onAddressPickerDone: () => void;
  consentGiven: boolean;
  onAcceptDisclaimer: () => void;
  celebrationStreak: number | null;
  setCelebrationStreak: (v: number | null) => void;
  childhoodWheelPending: boolean;
  setChildhoodWheelPending: (v: boolean) => void;
  setChildhoodRatings: (r: Record<string, number>) => void;
  setPairData: (data: PairsData) => void;
  userRole: 'CLIENT' | 'THERAPIST';
  displayName: string | null;
  setDisplayName: (name: string) => void;
  therapistMode: boolean;
  setTherapistMode: (v: boolean) => void;
  switchTherapistMode: (on: boolean) => void;
  diaryActiveSchemaIds: string[] | undefined;
  newDiaryEntry: 'schema' | 'mode' | 'gratitude' | null;
  setNewDiaryEntry: (v: 'schema' | 'mode' | 'gratitude' | null) => void;
  section: Section;
  setSection: (s: Section) => void;
}

// Оверлеи/шиты App.tsx, не относящиеся к главным экранам или истории
// потребностей (те — в AppSections/TrackerHistoryOverlay). Перенесено из
// App.tsx как есть (этап 3 REMEDIATION_PLAN) — без смены поведения.
export function AppOverlays({
  sheets,
  needs,
  ratings,
  saved,
  isOffline,
  onChange,
  onSaved,
  yesterdayRatings,
  onboardingSeen,
  addressFormReady,
  onAddressPickerDone,
  consentGiven,
  onAcceptDisclaimer,
  celebrationStreak,
  setCelebrationStreak,
  childhoodWheelPending,
  setChildhoodWheelPending,
  setChildhoodRatings,
  setPairData,
  userRole,
  displayName,
  setDisplayName,
  therapistMode,
  setTherapistMode,
  switchTherapistMode,
  diaryActiveSchemaIds,
  newDiaryEntry,
  setNewDiaryEntry,
  section,
  setSection,
}: Props) {
  return (
    <>
      {/* ── TrackerOverlay (NeedDial, per-need) ── */}
      {sheets.trackerOverlay && (
        <TrackerOverlay
          needs={needs}
          ratings={ratings}
          saved={saved}
          isOffline={isOffline}
          onChange={onChange}
          onSaved={onSaved}
          onClose={() =>
            sheets.close('trackerOverlay', { trackerNeedId: null })
          }
          initialNeedId={sheets.trackerNeedId}
          onOpenNote={() => sheets.open('todayNote')}
          onOpenGoal={() => sheets.open('trackerGoal')}
          onOpenHistory={() => {
            sheets.close('trackerOverlay', { trackerNeedId: null });
            sheets.open('tracker', { trackerTab: 'history' });
          }}
          yesterdayRatings={yesterdayRatings}
        />
      )}

      {/* ── Diaries overlay ── */}
      {sheets.diaries && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'var(--bg)',
            overflowY: 'auto',
          }}
        >
          <DiarySection onClose={() => sheets.close('diaries')} />
        </div>
      )}

      {/* Онбординг ждёт выбора формы обращения — иначе приветствие покажется
          в дефолтной форме до того, как пользователь её выбрал. */}
      {!onboardingSeen && addressFormReady && (
        <Disclaimer consentGiven={consentGiven} onAccept={onAcceptDisclaimer} />
      )}

      {celebrationStreak !== null && (
        <Celebration
          streak={celebrationStreak}
          insight={todayInsightPhrase(ratings)}
          onDone={() => {
            setCelebrationStreak(null);
            sheets.open('todayNote');
          }}
        />
      )}

      {sheets.todayNote && (
        <NoteSheet
          date={TODAY_DATE}
          onClose={() => {
            sheets.close('todayNote');
            if (childhoodWheelPending) {
              setChildhoodWheelPending(false);
              sheets.open('childhoodWheel');
            }
          }}
        />
      )}

      {sheets.trackerGoal && (
        <TaskCreateSheet
          defaultType="tracker_streak"
          onCreated={() => sheets.close('trackerGoal')}
          onClose={() => sheets.close('trackerGoal')}
        />
      )}

      {sheets.practicesOnboarding && needs.length > 0 && (
        <PracticesOnboarding
          needs={needs}
          onDone={() => {
            sheets.close('practicesOnboarding');
            if (childhoodWheelPending) {
              setChildhoodWheelPending(false);
              sheets.open('childhoodWheel');
            }
          }}
        />
      )}

      {sheets.childhoodWheel && (
        <ChildhoodWheelSheet
          onClose={() => sheets.close('childhoodWheel')}
          onOpenSchemas={() => {
            sheets.close('childhoodWheel');
            sheets.open('schemaInfo');
          }}
          onSaved={(r) => setChildhoodRatings(r)}
        />
      )}

      {sheets.pairSheet && (
        <PairSheet
          onClose={() => {
            sheets.close('pairSheet');
            api.getPair().then(setPairData);
          }}
        />
      )}

      {sheets.about && (
        <AboutSheet
          onClose={() => sheets.close('about')}
          onOpenSchemaInfo={() => {
            sheets.close('about');
            sheets.open('schemaInfo');
          }}
        />
      )}

      {sheets.settings && (
        <SettingsSheet
          onClose={() => sheets.close('settings')}
          userRole={userRole}
          displayName={displayName}
          onNameChanged={setDisplayName}
          onOpenTherapistCabinet={() => {
            sheets.close('settings');
            setTherapistMode(true);
          }}
          therapistMode={therapistMode}
          onToggleTherapistMode={() => switchTherapistMode(!therapistMode)}
        />
      )}
      {sheets.addressPicker && (
        <AddressFormPicker
          onDone={() => {
            sessionStorage.setItem('addr_form_asked', '1');
            sheets.close('addressPicker');
            onAddressPickerDone();
          }}
        />
      )}
      <DonateNudge />

      {/* therapistMode renders inline in main flow, not as overlay — see below */}
      {sheets.practices && (
        <PracticesScreen
          onClose={() => sheets.close('practices')}
          onOpenTracker={() => {
            sheets.close('practices');
            sheets.open('trackerOverlay', { trackerNeedId: null });
          }}
        />
      )}
      {sheets.plans && (
        <PlansScreen
          onClose={() => sheets.close('plans')}
          onOpenTracker={() => {
            sheets.close('plans');
            sheets.open('trackerOverlay', { trackerNeedId: null });
          }}
        />
      )}
      {sheets.schemaInfo && (
        <SchemaInfoSheet
          onClose={() =>
            sheets.close('schemaInfo', {
              schemaAutoStartTest: false,
              schemaHighlight: undefined,
            })
          }
          ratings={ratings}
          autoStartTest={sheets.schemaAutoStartTest}
          initialTab={sheets.schemaInitialTab}
          highlightSchema={sheets.schemaHighlight}
        />
      )}

      <AppDiaryNav
        sheets={sheets}
        therapistMode={therapistMode}
        newDiaryEntry={newDiaryEntry}
        setNewDiaryEntry={setNewDiaryEntry}
        diaryActiveSchemaIds={diaryActiveSchemaIds}
        section={section}
        setSection={setSection}
        userRole={userRole}
      />
    </>
  );
}
