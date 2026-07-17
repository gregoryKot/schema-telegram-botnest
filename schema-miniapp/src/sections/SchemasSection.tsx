import { useEffect, useState } from 'react';
import { api } from '../api';
import { useNeedData } from '../needData';
import { useSafeTop } from '../utils/safezone';
import { SchemaPickerSheet } from '../components/SchemaPickerSheet';
import { ModeIntroSheet } from '../components/ModeIntroSheet';
import { SchemaIntroSheet } from '../components/SchemaIntroSheet';
import { SchemaDetailSheet } from '../components/SchemaDetailSheet';
import { NeedDetailSheet } from '../components/NeedDetailSheet';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../utils/storageKeys';
import { readLocalIds } from './schemas/utils';
import { ModePickerSheet } from './schemas/ModePickerSheet';
import { SchemasTab } from './schemas/SchemasTab';
import { ModesTab } from './schemas/ModesTab';
import { NeedsTab } from './schemas/NeedsTab';

interface Props {
  onOpenSchema: (opts?: {
    startTest?: boolean;
    tab?: 'needs' | 'schemas' | 'modes';
    highlight?: string;
  }) => void;
  childhoodRatings?: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
}

type Tab = 'schemas' | 'modes' | 'needs';

export function SchemasSection({
  onOpenSchema,
  childhoodRatings = {},
  onOpenChildhoodWheel,
}: Props) {
  const NEED_DATA = useNeedData();
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
  const [detailSchemaId, setDetailSchemaId] = useState<string | null>(null);
  const [introSchemaId, setIntroSchemaId] = useState<string | null>(null);
  const [detailNeedId, setDetailNeedId] = useState<string | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    new Set(),
  );
  const [expandedModeGroups, setExpandedModeGroups] = useState<Set<string>>(
    new Set(),
  );
  const [ysqCompletedAt, setYsqCompletedAt] = useState<string | null>(null);
  const safeTop = useSafeTop();

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
  }, []);

  const allSchemaIds = [...new Set([...ysqSchemaIds, ...manualSchemaIds])];

  function saveSchemas(ids: string[]) {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(ids));
    setManualSchemaIds(ids);
    api.updateSettings({ mySchemaIds: ids }).catch(() => {});
  }

  function toggleDomain(id: string) {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModeGroup(id: string) {
    setExpandedModeGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasChildhood = Object.keys(childhoodRatings).length > 0;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'schemas', label: 'Схемы' },
    { id: 'modes', label: 'Режимы' },
    { id: 'needs', label: 'Потребности' },
  ];

  return (
    <div
      style={{ minHeight: '100vh', paddingBottom: 140, paddingTop: safeTop }}
    >
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
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.5px',
              lineHeight: 1.15,
            }}
          >
            Паттерны
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 3 }}>
            Схемы, режимы, потребности
          </div>
        </div>
        <button
          onClick={() => onOpenSchema()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: 'none',
            background: 'rgba(var(--fg-rgb),0.07)',
            color: 'var(--text-sub)',
            fontSize: 18,
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
          📖
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
      </div>

      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {tab === 'schemas' && (
          <SchemasTab
            profileLoading={profileLoading}
            allSchemaIds={allSchemaIds}
            expandedDomains={expandedDomains}
            ysqCompletedAt={ysqCompletedAt}
            onSelectSchema={setDetailSchemaId}
            onAddSchema={() => setShowSchemaPicker(true)}
            onToggleDomain={toggleDomain}
            onOpenSchema={onOpenSchema}
          />
        )}

        {tab === 'modes' && (
          <ModesTab
            profileLoading={profileLoading}
            myModeIds={myModeIds}
            expandedModeGroups={expandedModeGroups}
            onSelectMode={setIntroModeId}
            onAddMode={() => setShowModePicker(true)}
            onToggleModeGroup={toggleModeGroup}
          />
        )}

        {tab === 'needs' && (
          <NeedsTab
            NEED_DATA={NEED_DATA}
            childhoodRatings={childhoodRatings}
            hasChildhood={hasChildhood}
            onOpenChildhoodWheel={onOpenChildhoodWheel}
            onSelectNeed={setDetailNeedId}
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

      {detailSchemaId && (
        <SchemaDetailSheet
          schemaId={detailSchemaId}
          onClose={() => setDetailSchemaId(null)}
          onOpenDiary={() => setIntroSchemaId(detailSchemaId)}
        />
      )}

      {introSchemaId && (
        <SchemaIntroSheet
          schemaId={introSchemaId}
          onClose={() => setIntroSchemaId(null)}
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
