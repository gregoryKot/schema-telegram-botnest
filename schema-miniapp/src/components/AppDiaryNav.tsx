import { api } from '../api';
import { BottomNav, Section } from './BottomNav';
import { FloatingPill } from './FloatingPill';
import { SchemaEntrySheet } from './diary/SchemaEntrySheet';
import { ModeEntrySheet } from './diary/ModeEntrySheet';
import { GratitudeEntrySheet } from './diary/GratitudeEntrySheet';
import { UseSheetsReturn } from '../hooks/useSheets';
import { TODAY_DATE } from '../utils/todayConstants';

interface Props {
  sheets: UseSheetsReturn;
  therapistMode: boolean;
  newDiaryEntry: 'schema' | 'mode' | 'gratitude' | null;
  setNewDiaryEntry: (v: 'schema' | 'mode' | 'gratitude' | null) => void;
  diaryActiveSchemaIds: string[] | undefined;
  section: Section;
  setSection: (s: Section) => void;
  userRole: 'CLIENT' | 'THERAPIST';
}

// Дневниковые шиты из FloatingPill + сам FloatingPill/BottomNav (скрыты,
// пока открыт любой полноэкранный оверлей). Перенесено из App.tsx как есть
// (этап 3 REMEDIATION_PLAN) — без смены поведения.
export function AppDiaryNav({
  sheets,
  therapistMode,
  newDiaryEntry,
  setNewDiaryEntry,
  diaryActiveSchemaIds,
  section,
  setSection,
  userRole,
}: Props) {
  return (
    <>
      {/* ── Diary entry sheets (from FloatingPill) ── */}
      {newDiaryEntry === 'schema' && (
        <SchemaEntrySheet
          activeSchemaIds={diaryActiveSchemaIds}
          onClose={() => setNewDiaryEntry(null)}
          onSave={async (data) => {
            await api.createSchemaDiary(data);
          }}
        />
      )}
      {newDiaryEntry === 'mode' && (
        <ModeEntrySheet
          onClose={() => setNewDiaryEntry(null)}
          onSave={async (data) => {
            await api.createModeDiary(data);
          }}
        />
      )}
      {newDiaryEntry === 'gratitude' && (
        <GratitudeEntrySheet
          onClose={() => setNewDiaryEntry(null)}
          date={TODAY_DATE}
          onSave={async (date, items) => {
            await api.createGratitudeDiary(date, items);
          }}
        />
      )}

      {/* ── Floating pill (always above bottom bar) ── */}
      {!therapistMode &&
        !sheets.tracker &&
        !sheets.diaries &&
        !sheets.schemaInfo &&
        !sheets.settings &&
        !sheets.practices &&
        !sheets.plans &&
        !sheets.childhoodWheel &&
        !newDiaryEntry && (
          <FloatingPill
            onOpenTracker={() => {
              sheets.open('trackerOverlay', { trackerNeedId: null });
            }}
            onOpenSchemaDiary={() => setNewDiaryEntry('schema')}
            onOpenModeDiary={() => setNewDiaryEntry('mode')}
            onOpenGratitude={() => setNewDiaryEntry('gratitude')}
          />
        )}

      {!therapistMode &&
        !sheets.tracker &&
        !sheets.diaries &&
        !sheets.schemaInfo &&
        !sheets.settings &&
        !sheets.practices &&
        !sheets.plans &&
        !sheets.childhoodWheel &&
        !newDiaryEntry && (
          <BottomNav
            section={section}
            onSelect={setSection}
            userRole={userRole}
          />
        )}
    </>
  );
}
