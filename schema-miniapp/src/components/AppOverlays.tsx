import { Need } from '../types';
import { PairsData, StreakData } from '../api';
import { Section } from './BottomNav';
import { TrackerOverlay } from './TrackerOverlay';
import { Disclaimer } from './Disclaimer';
import { SettingsSheet } from './SettingsSheet';
import { AddressFormPicker } from './AddressFormPicker';
import { DonateNudge } from './DonateNudge';
import { Celebration } from './Celebration';
import { todayInsightPhrase } from '../utils/todayInsight';
import { NoteSheet } from './NoteSheet';
import { PairSheet } from './PairSheet';
import { JoinConfirmSheet } from './JoinConfirmSheet';
import { AboutSheet } from './AboutSheet';
import {
  LazyDiarySection as DiarySection,
  LazyPracticesScreen as PracticesScreen,
  LazyPlansScreen as PlansScreen,
  LazySchemaInfoSheet as SchemaInfoSheet,
  LazyChildhoodWheelSheet as ChildhoodWheelSheet,
  LazyTaskCreateSheet as TaskCreateSheet,
} from './LazyOverlays';
import { AppDiaryNav } from './AppDiaryNav';
import { UseSheetsReturn } from '../hooks/useSheets';
import type { OverlaySheetKey } from '../hooks/sheetsStack';
import { TODAY_DATE } from '../utils/todayConstants';

interface Props {
  sheets: UseSheetsReturn;
  /** Единый реестр закрытия листов (useHostBackButton): крестик = «Назад». */
  closers: Record<OverlaySheetKey, () => void>;
  needs: Need[];
  ratings: Record<string, number>;
  saved: Record<string, boolean>;
  isOffline: boolean;
  onChange: (needId: string, value: number) => void;
  onSaved: (needId: string, streak?: StreakData) => void;
  yesterdayRatings: Record<string, number>;
  showOnboarding: boolean;
  consentGiven: boolean;
  onConsentDisclaimer: () => void;
  onAcceptDisclaimer: () => void;
  celebrationStreak: number | null;
  setCelebrationStreak: (v: number | null) => void;
  setChildhoodRatings: (r: Record<string, number>) => void;
  setPairData: (data: PairsData) => void;
  userRole: 'CLIENT' | 'THERAPIST';
  displayName: string | null;
  setDisplayName: (name: string) => void;
  therapistMode: boolean;
  switchTherapistMode: (on: boolean) => void;
  onResignTherapist: () => Promise<void> | void;
  diaryActiveSchemaIds: string[] | undefined;
  newDiaryEntry: 'schema' | 'mode' | 'gratitude' | null;
  setNewDiaryEntry: (v: 'schema' | 'mode' | 'gratitude' | null) => void;
  section: Section;
  setSection: (s: Section) => void;
}

// Оверлеи/шиты App.tsx, не относящиеся к главным экранам или истории
// потребностей (те — в AppSections/TrackerHistoryOverlay). Перенесено из
// App.tsx как есть (этап 3 REMEDIATION_PLAN) — без смены поведения.
import { CaseFlowOverlay } from './caseFlow/CaseFlowOverlay';
import { SelfMapOverlay } from './selfMap/SelfMapOverlay';

export function AppOverlays({
  sheets,
  closers,
  needs,
  ratings,
  saved,
  isOffline,
  onChange,
  onSaved,
  yesterdayRatings,
  showOnboarding,
  consentGiven,
  onConsentDisclaimer,
  onAcceptDisclaimer,
  celebrationStreak,
  setCelebrationStreak,
  setChildhoodRatings,
  setPairData,
  userRole,
  displayName,
  setDisplayName,
  therapistMode,
  switchTherapistMode,
  onResignTherapist,
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
          onClose={closers.trackerOverlay}
          initialNeedId={sheets.trackerNeedId}
          onOpenNote={() => sheets.open('todayNote')}
          onOpenGoal={() => sheets.open('trackerGoal')}
          onOpenHistory={() => {
            closers.trackerOverlay();
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
            overflowY: 'auto',
          }}
        >
          <DiarySection
            onClose={closers.diaries}
            onOpenTracker={() => {
              closers.diaries();
              sheets.open('trackerOverlay', { trackerNeedId: null });
            }}
          />
        </div>
      )}

      {/* Условие показа — shouldShowOnboarding в App.tsx (ждёт выбора формы
          обращения и загрузки серверных флагов). */}
      {showOnboarding && (
        <Disclaimer
          consentGiven={consentGiven}
          onConsent={onConsentDisclaimer}
          onAccept={onAcceptDisclaimer}
        />
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
        <NoteSheet date={TODAY_DATE} onClose={closers.todayNote} />
      )}

      {sheets.trackerGoal && (
        <TaskCreateSheet
          defaultType="tracker_streak"
          onCreated={closers.trackerGoal}
          onClose={closers.trackerGoal}
        />
      )}

      {sheets.caseFlow && <CaseFlowOverlay sheets={sheets} />}

      {sheets.selfMap && <SelfMapOverlay sheets={sheets} />}

      {sheets.childhoodWheel && (
        <ChildhoodWheelSheet
          onClose={closers.childhoodWheel}
          onOpenSchemas={() => {
            closers.childhoodWheel();
            sheets.open('schemaInfo');
          }}
          onSaved={(r) => setChildhoodRatings(r)}
        />
      )}

      {sheets.pairSheet && <PairSheet onClose={closers.pairSheet} />}

      {sheets.joinConfirm && sheets.joinKind && sheets.joinCode && (
        <JoinConfirmSheet
          joinKind={sheets.joinKind}
          joinCode={sheets.joinCode}
          onClose={closers.joinConfirm}
          onPairJoined={setPairData}
        />
      )}

      {sheets.about && (
        <AboutSheet
          onClose={closers.about}
          onOpenSchemaInfo={() => {
            closers.about();
            sheets.open('schemaInfo');
          }}
        />
      )}

      {sheets.settings && (
        <SettingsSheet
          onClose={closers.settings}
          userRole={userRole}
          displayName={displayName}
          onNameChanged={setDisplayName}
          onOpenTherapistCabinet={() => {
            closers.settings();
            switchTherapistMode(true);
          }}
          therapistMode={therapistMode}
          onToggleTherapistMode={() => switchTherapistMode(!therapistMode)}
          onResignTherapist={onResignTherapist}
        />
      )}
      {sheets.addressPicker && (
        <AddressFormPicker onDone={closers.addressPicker} />
      )}
      <DonateNudge />

      {/* therapistMode renders inline in main flow, not as overlay — see below */}
      {sheets.practices && (
        <PracticesScreen
          onClose={closers.practices}
          onOpenTracker={() => {
            closers.practices();
            sheets.open('trackerOverlay', { trackerNeedId: null });
          }}
        />
      )}
      {sheets.plans && (
        <PlansScreen
          onClose={closers.plans}
          onOpenTracker={() => {
            closers.plans();
            sheets.open('trackerOverlay', { trackerNeedId: null });
          }}
        />
      )}
      {sheets.schemaInfo && (
        <SchemaInfoSheet
          onClose={closers.schemaInfo}
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
