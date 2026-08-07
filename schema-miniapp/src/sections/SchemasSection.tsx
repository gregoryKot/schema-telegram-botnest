import { useEffect, useState } from 'react';
import { api } from '../api';
import { useSafeTop } from '../utils/safezone';
import { SaveErrorNote } from '../components/SaveErrorNote';
import { SchemaPickerSheet } from '../components/SchemaPickerSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { INTRO_MODE_ID } from '../components/ModesHero';
import { NeedDetailSheet } from '../components/NeedDetailSheet';
import {
  weekSchemaSummary,
  weekSchemaFrequency,
  weekModeSummary,
  weekModeFrequency,
  WeekTopSummary,
} from '../utils/patternsSummary';
import { Tab, SchemasSectionProps as Props } from './schemas/types';
import { SchemasTab } from './schemas/SchemasTab';
import { ModesTab } from './schemas/ModesTab';
import { NeedsTab } from './schemas/NeedsTab';
import { ModePickerSheet } from './schemas/ModePickerSheet';
import { useMySelections } from './schemas/useMySelections';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../types';

export function SchemasSection({
  onOpenSchema,
  childhoodRatings = {},
  onOpenChildhoodWheel,
  onOpenDiaries,
}: Props) {
  const [tab, setTab] = useState<Tab>('schemas');
  const {
    manualSchemaIds,
    myModeIds,
    ysqSchemaIds,
    ysqCompletedAt,
    profileLoading,
    schemaSaveError,
    modeSaveError,
    saveSchemas,
    saveModes,
  } = useMySelections();
  const [showSchemaPicker, setShowSchemaPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [introModeId, setIntroModeId] = useState<string | null>(null);
  const [detailNeedId, setDetailNeedId] = useState<string | null>(null);
  const [schemaEntries, setSchemaEntries] = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries, setModeEntries] = useState<ModeDiaryEntry[]>([]);
  const [ysqProgressAnswered, setYsqProgressAnswered] = useState<number | null>(
    null,
  );
  const [weekSummary, setWeekSummary] = useState<WeekTopSummary | null>(null);
  const [modeSummary, setModeSummary] = useState<WeekTopSummary | null>(null);
  const [schemaFreq, setSchemaFreq] = useState<Record<string, number>>({});
  const [modeFreq, setModeFreq] = useState<Record<string, number>>({});
  const safeTop = useSafeTop();

  useEffect(() => {
    api
      .getSchemaDiary()
      .then((entries) => {
        setSchemaEntries(entries);
        setWeekSummary(weekSchemaSummary(entries));
        setSchemaFreq(weekSchemaFrequency(entries));
      })
      .catch((e) => console.error('getSchemaDiary failed', e));
    api
      .getModeDiary()
      .then((entries) => {
        setModeEntries(entries);
        setModeSummary(weekModeSummary(entries));
        setModeFreq(weekModeFrequency(entries));
      })
      .catch((e) => console.error('getModeDiary failed', e));
    api
      .getYsqProgress()
      .then((progress) =>
        setYsqProgressAnswered(
          Array.isArray(progress?.answers)
            ? progress.answers.filter((a) => a > 0).length
            : null,
        ),
      )
      .catch((e) => console.error('getYsqProgress failed', e));
  }, []);

  const allSchemaIds = [...new Set([...ysqSchemaIds, ...manualSchemaIds])];

  const TABS: { id: Tab; label: string }[] = [
    { id: 'schemas', label: 'Схемы' },
    { id: 'modes', label: 'Режимы' },
    { id: 'needs', label: 'Потребности' },
  ];

  return (
    <div className="section-pad" style={{ paddingTop: safeTop }}>
      {/* ── Header ── */}
      <div
        style={{
          padding: '24px 20px 0',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            className="d-display"
            style={{
              fontSize: 27,
              lineHeight: 1.15,
            }}
          >
            Паттерны
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 3 }}>
            Привычные реакции родом из детства
          </div>
        </div>
        <button
          onClick={() => onOpenSchema()}
          className="d-caps"
          style={{
            minHeight: 48,
            padding: '0 14px',
            borderRadius: 14,
            border: 'none',
            background: 'var(--surface-2)',
            color: 'var(--accent)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 4,
          }}
          title="Библиотека схема-терапии"
          aria-label="Библиотека схема-терапии"
        >
          Библиотека
        </button>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ padding: '16px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: 3,
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 11,
                border: 'none',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: tab === t.id ? 700 : 400,
                cursor: 'pointer',
                background: tab === t.id ? 'var(--sheet-bg)' : 'transparent',
                color: tab === t.id ? 'var(--text)' : 'var(--text-sub)',
                transition: 'all 0.18s',
                boxShadow: tab === t.id ? '0 1px 6px rgba(0,0,0,0.18)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {((tab === 'schemas' && schemaSaveError) ||
          (tab === 'modes' && modeSaveError)) && (
          <div style={{ marginTop: 8 }}>
            <SaveErrorNote
              ty="Не удалось сохранить выбор на сервере. Здесь применилось, но на другом устройстве может не появиться — попробуй ещё раз."
              vy="Не удалось сохранить выбор на сервере. Здесь применилось, но на другом устройстве может не появиться — попробуйте ещё раз."
            />
          </div>
        )}
      </div>

      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* ══════════════════════ СХЕМЫ ══════════════════════ */}
        {tab === 'schemas' && (
          <SchemasTab
            profileLoading={profileLoading}
            allSchemaIds={allSchemaIds}
            ysqCompletedAt={ysqCompletedAt}
            ysqProgressAnswered={ysqProgressAnswered}
            weekSummary={weekSummary}
            schemaFreq={schemaFreq}
            schemaEntries={schemaEntries}
            setSchemaEntries={setSchemaEntries}
            onOpenSchema={onOpenSchema}
            onOpenDiaries={onOpenDiaries}
            onShowSchemaPicker={() => setShowSchemaPicker(true)}
          />
        )}

        {/* ══════════════════════ РЕЖИМЫ ══════════════════════ */}
        {tab === 'modes' && (
          <ModesTab
            profileLoading={profileLoading}
            myModeIds={myModeIds}
            modeSummary={modeSummary}
            modeFreq={modeFreq}
            modeEntries={modeEntries}
            setModeEntries={setModeEntries}
            onOpenSchema={onOpenSchema}
            onOpenDiaries={onOpenDiaries}
            onShowModePicker={() => setShowModePicker(true)}
            onMeetCritic={() => setIntroModeId(INTRO_MODE_ID)}
          />
        )}

        {/* ══════════════════════ ПОТРЕБНОСТИ ══════════════════════ */}
        {tab === 'needs' && (
          <NeedsTab
            childhoodRatings={childhoodRatings}
            onOpenChildhoodWheel={onOpenChildhoodWheel}
            onOpenNeedDetail={(id) => setDetailNeedId(id)}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {showSchemaPicker && (
        <SchemaPickerSheet
          selected={manualSchemaIds}
          onSave={saveSchemas}
          onClose={() => setShowSchemaPicker(false)}
        />
      )}

      {showModePicker && (
        <ModePickerSheet
          selected={myModeIds}
          onSave={saveModes}
          onClose={() => setShowModePicker(false)}
        />
      )}

      {introModeId && (
        <ModeIntroSheet
          modeId={introModeId}
          onClose={() => setIntroModeId(null)}
        />
      )}

      {detailNeedId && (
        <NeedDetailSheet
          needId={detailNeedId}
          childhoodRating={childhoodRatings[detailNeedId]}
          activeSchemaIds={allSchemaIds}
          onClose={() => setDetailNeedId(null)}
        />
      )}
    </div>
  );
}
