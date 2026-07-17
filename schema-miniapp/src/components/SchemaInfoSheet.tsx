import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';
import { YSQTestSheet, YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from './YSQTestSheet';
import { TherapyNote } from './TherapyNote';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { NeedsTab } from './schemaInfoSheet/NeedsTab';
import { SchemasTab } from './schemaInfoSheet/SchemasTab';
import { ModesTab } from './schemaInfoSheet/ModesTab';
export { SCHEMA_DOMAINS };

type Tab = 'needs' | 'schemas' | 'modes';

/* ─── Main Component ─── */
export type SchemaInfoTab = 'needs' | 'schemas' | 'modes';
interface Props {
  onClose: () => void;
  ratings?: Record<string, number>;
  autoStartTest?: boolean;
  initialTab?: SchemaInfoTab;
  highlightSchema?: string;
}

const SCHEMA_TABS: { key: Tab; label: string }[] = [
  { key: 'needs', label: 'Потребности' },
  { key: 'schemas', label: 'Схемы' },
  { key: 'modes', label: 'Режимы' },
];

export function SchemaInfoContent({
  initialTab,
  highlight,
}: {
  initialTab?: Tab;
  highlight?: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'needs');
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <SectionLabel purple mb={6}>
          Схема-терапия
        </SectionLabel>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
          Как это работает
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          background: 'rgba(var(--fg-rgb),0.06)',
          borderRadius: 12,
          padding: 3,
          marginBottom: 20,
        }}
      >
        {SCHEMA_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: 10,
                background: active ? 'rgba(var(--fg-rgb),0.12)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-faint)',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === 'needs' && <NeedsTab />}
      {tab === 'schemas' && <SchemasTab highlight={highlight} />}
      {tab === 'modes' && <ModesTab />}
      <div style={{ marginTop: 24 }}>
        <TherapyNote />
      </div>
    </div>
  );
}

export function SchemaInfoSheet({
  onClose,
  ratings,
  autoStartTest,
  initialTab,
  highlightSchema: initHighlight,
}: Props) {
  const [showTest, setShowTest] = useState(autoStartTest ?? false);
  const [contentKey, setContentKey] = useState(0);
  const [contentInitialTab, setContentInitialTab] = useState<Tab>(
    initialTab ?? 'needs',
  );
  const hasResult = !!localStorage.getItem(YSQ_RESULT_KEY);
  const hasProgress = !!localStorage.getItem(YSQ_PROGRESS_KEY);

  const [highlightSchema, setHighlightSchema] = useState<string | undefined>(
    initHighlight,
  );

  const handleViewSchemas = (schemaName?: string) => {
    setContentInitialTab('schemas');
    setHighlightSchema(schemaName);
    setContentKey((k) => k + 1);
    setShowTest(false);
  };

  return (
    <>
      <BottomSheet onClose={onClose}>
        <div style={{ paddingTop: 4 }}>
          <SchemaInfoContent
            key={contentKey}
            initialTab={contentInitialTab}
            highlight={highlightSchema}
          />
          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: '1px solid rgba(var(--fg-rgb),0.06)',
            }}
          >
            {hasProgress && !hasResult && (
              <div
                onClick={() => setShowTest(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowTest(true);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  marginBottom: 12,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 18 }}>⏸</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--accent-yellow)',
                    }}
                  >
                    Незаконченный тест
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-sub)',
                      marginTop: 2,
                    }}
                  >
                    Нажми, чтобы продолжить с места остановки
                  </div>
                </div>
                <span style={{ fontSize: 16, color: 'var(--accent-yellow)' }}>
                  ›
                </span>
              </div>
            )}
            <div
              onClick={() => setShowTest(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowTest(true);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background:
                  'color-mix(in srgb, var(--accent) 10%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                borderRadius: 14,
                padding: '14px 16px',
                cursor: 'pointer',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--accent)',
                  }}
                >
                  {hasResult
                    ? 'Мои результаты теста'
                    : hasProgress
                      ? 'Продолжить тест'
                      : 'Пройти тест на схемы'}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-sub)',
                    marginTop: 3,
                  }}
                >
                  {hasResult
                    ? 'Посмотреть или пройти заново'
                    : '116 вопросов · ~10 минут'}
                </div>
              </div>
              <span style={{ fontSize: 20, color: 'var(--accent)' }}>›</span>
            </div>
          </div>
        </div>
      </BottomSheet>
      {showTest && (
        <YSQTestSheet
          onClose={() => setShowTest(false)}
          ratings={ratings}
          autoResume={autoStartTest}
          onViewSchemas={(name) => handleViewSchemas(name)}
        />
      )}
    </>
  );
}
