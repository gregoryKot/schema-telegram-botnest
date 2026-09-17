import { useState } from 'react';
import { api } from '../api';
import { BottomNav, Section } from './BottomNav';
import { FloatingPill } from './FloatingPill';
// Ленивые: статический импорт тянул modeCards/healthyAdultHints/62КБ
// GratitudeEntrySheet в стартовый граф (замер 2026-08-23, LazyDiarySheets.tsx).
import {
  LazySchemaEntrySheet as SchemaEntrySheet,
  LazyModeEntrySheet as ModeEntrySheet,
  LazyGratitudeEntrySheet as GratitudeEntrySheet,
} from './LazyDiarySheets';
import {
  QuickActionOverlays,
  type OverlayQuickActionId,
} from './plusMenu/QuickActionOverlays';
import { UseSheetsReturn } from '../hooks/useSheets';
import { TODAY_DATE } from '../utils/todayConstants';
import type { QuickActionId } from '../utils/quickActions';

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
  const [activeOverlay, setActiveOverlay] =
    useState<OverlayQuickActionId | null>(null);

  function handleAction(id: QuickActionId) {
    switch (id) {
      case 'diary_schema':
        setNewDiaryEntry('schema');
        return;
      case 'diary_mode':
        setNewDiaryEntry('mode');
        return;
      case 'diary_gratitude':
        setNewDiaryEntry('gratitude');
        return;
      case 'tracker':
        sheets.open('trackerOverlay', { trackerNeedId: null });
        return;
      case 'case':
        // Разбор случая — главное действие продукта, поэтому не через
        // локальный activeOverlay (тот закрывается вместе с пилюлей/навом),
        // а через общий реестр листов sheets (как onStartCase в App.tsx) —
        // AppOverlays уже рендерит CaseFlowOverlay по sheets.caseFlow.
        sheets.open('caseFlow');
        return;
      case 'breathing':
      case 'grounding':
      case 'stop':
        setActiveOverlay(id);
        return;
      default:
        // belief_check/phrase_check/flashcard/safe_place/letter_to_self/
        // warm_words/childhood_wheel/tasks/practices/plans — поверхность
        // «Инструменты», из «плюса» недостижимы (один дом на действие, см.
        // utils/quickActionsRegistry.ts).
        return;
    }
  }

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

      {/* ── Экстренная практика из «плюса» (дыхание/заземление/«Стоп») ── */}
      <QuickActionOverlays
        active={activeOverlay}
        onClose={() => setActiveOverlay(null)}
      />

      {/* ── Floating pill (above bottom bar, на всех экранах) ──
          Ж3 (аудит 2026-08, #405) прятала «+» на «Сегодня», чтобы не
          конкурировать с CTA TodayFocusCard. Владелец откатил решение
          2026-08-25: «+» — привычная точка входа, её пропажа с главного
          экрана читается как поломка, а не как фокусировка. */}
      {!therapistMode &&
        !sheets.tracker &&
        !sheets.diaries &&
        !sheets.schemaInfo &&
        !sheets.settings &&
        !sheets.practices &&
        !sheets.plans &&
        !sheets.childhoodWheel &&
        !newDiaryEntry &&
        !activeOverlay && <FloatingPill onAction={handleAction} />}

      {!therapistMode &&
        !sheets.tracker &&
        !sheets.diaries &&
        !sheets.schemaInfo &&
        !sheets.settings &&
        !sheets.practices &&
        !sheets.plans &&
        !sheets.childhoodWheel &&
        !newDiaryEntry &&
        !activeOverlay && (
          <BottomNav
            section={section}
            onSelect={setSection}
            userRole={userRole}
          />
        )}
    </>
  );
}
