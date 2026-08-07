import { useEffect, useState } from 'react';
import { api } from '../api';
import { useSafeTop } from '../utils/safezone';
import { SchemaPickerSheet } from '../components/SchemaPickerSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { INTRO_MODE_ID } from '../components/ModesHero';
import { NeedDetailSheet } from '../components/NeedDetailSheet';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import {
  weekSchemaSummary,
  weekSchemaFrequency,
  weekModeSummary,
  weekModeFrequency,
  WeekTopSummary,
} from '../utils/patternsSummary';
import { readLocalIds } from './schemas/utils';
import { Tab, SchemasSectionProps as Props } from './schemas/types';
import { PatternsHeader } from './schemas/PatternsHeader';
import { SchemasTab } from './schemas/SchemasTab';
import { ModesTab } from './schemas/ModesTab';
import { NeedsTab } from './schemas/NeedsTab';
import { ModePickerSheet } from './schemas/ModePickerSheet';
import { useScreenBlocks } from '../hooks/useScreenBlocks';
import { SCREEN_HIDDEN_KEYS } from '../utils/screenBlocks';
import { ScreenCustomizeSheet } from '../components/customize/ScreenCustomizeSheet';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../types';

export function SchemasSection({
  onOpenSchema,
  childhoodRatings = {},
  onOpenChildhoodWheel,
  onOpenDiaries,
}: Props) {
  const [tab, setTab] = useState<Tab>('schemas');
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() =>
    readLocalIds(MY_SCHEMA_IDS_KEY),
  );
  const [myModeIds, setMyModeIds] = useState<string[]>(() =>
    readLocalIds(MY_MODE_IDS_KEY),
  );
  const [ysqSchemaIds, setYsqSchemaIds] = useState<string[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showSchemaPicker, setShowSchemaPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [introModeId, setIntroModeId] = useState<string | null>(null);
  const [detailNeedId, setDetailNeedId] = useState<string | null>(null);
  const [schemaEntries, setSchemaEntries] = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries, setModeEntries] = useState<ModeDiaryEntry[]>([]);
  const [ysqCompletedAt, setYsqCompletedAt] = useState<string | null>(null);
  const [ysqProgressAnswered, setYsqProgressAnswered] = useState<number | null>(
    null,
  );
  const [weekSummary, setWeekSummary] = useState<WeekTopSummary | null>(null);
  const [modeSummary, setModeSummary] = useState<WeekTopSummary | null>(null);
  const [schemaFreq, setSchemaFreq] = useState<Record<string, number>>({});
  const [modeFreq, setModeFreq] = useState<Record<string, number>>({});
  const safeTop = useSafeTop();
  const blocks = useScreenBlocks('patterns', SCREEN_HIDDEN_KEYS.patterns);

  useEffect(() => {
    api
      .getProfile()
      .then((p) => {
        const serverSchemas = p.mySchemaIds ?? [];
        const serverModes = p.myModeIds ?? [];
        setManualSchemaIds(serverSchemas);
        if (serverSchemas.length > 0)
          localStorage.setItem(
            MY_SCHEMA_IDS_KEY,
            JSON.stringify(serverSchemas),
          );
        setMyModeIds(serverModes);
        if (serverModes.length > 0)
          localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(serverModes));
        setYsqSchemaIds(p.ysq.activeSchemaIds ?? []);
        setYsqCompletedAt(p.ysq.completedAt);
        setProfileLoading(false);
      })
      .catch(() => setProfileLoading(false));
    api
      .getSchemaDiary()
      .then((entries) => {
        setSchemaEntries(entries);
        setWeekSummary(weekSchemaSummary(entries));
        setSchemaFreq(weekSchemaFrequency(entries));
      })
      .catch(() => {});
    api
      .getModeDiary()
      .then((entries) => {
        setModeEntries(entries);
        setModeSummary(weekModeSummary(entries));
        setModeFreq(weekModeFrequency(entries));
      })
      .catch(() => {});
    api
      .getYsqProgress()
      .then((progress) =>
        setYsqProgressAnswered(
          Array.isArray(progress?.answers)
            ? progress.answers.filter((a) => a > 0).length
            : null,
        ),
      )
      .catch(() => {});
  }, []);

  const allSchemaIds = [...new Set([...ysqSchemaIds, ...manualSchemaIds])];

  function saveSchemas(ids: string[]) {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(ids));
    setManualSchemaIds(ids);
    api.updateSettings({ mySchemaIds: ids }).catch(() => {});
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'schemas', label: 'Схемы' },
    { id: 'modes', label: 'Режимы' },
    { id: 'needs', label: 'Потребности' },
  ];

  return (
    <div className="section-pad" style={{ paddingTop: safeTop }}>
      {/* ── Header ── */}
      <PatternsHeader
        onOpenSchema={() => onOpenSchema()}
        onCustomize={blocks.openByGear}
      />

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
            blocks={blocks}
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
            blocks={blocks}
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
          onSave={(ids) => {
            localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(ids));
            setMyModeIds(ids);
            api.updateSettings({ myModeIds: ids }).catch(() => {});
          }}
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

      {/* ── Лист «Настроить экран» (шестерёнка / долгое нажатие) ── */}
      {blocks.sheet !== null && (
        <ScreenCustomizeSheet
          screen="patterns"
          hidden={blocks.hidden}
          highlight={blocks.highlight}
          onToggle={blocks.toggle}
          onClose={blocks.closeSheet}
        />
      )}
    </div>
  );
}
