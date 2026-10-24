import { useState, lazy, Suspense } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from '../utils/storageKeys';
import { TherapyNote } from './TherapyNote';
import { useTr } from '../utils/addressForm';
import { ModesTab } from './schemaInfoSheet/ModesTab';
import { NeedsTab } from './schemaInfoSheet/NeedsTab';
import { SchemasTab } from './schemaInfoSheet/SchemasTab';
import { SsSheet, SsHead } from './schemaSheets/SsSheet';

const YSQTestSheet = lazy(() => import('./YSQTestSheet').then(m => ({ default: m.YSQTestSheet })));

type Tab = 'needs' | 'schemas' | 'modes';

const SCHEMA_TABS: { key: Tab; label: string }[] = [
  { key: 'needs',   label: 'Потребности' },
  { key: 'schemas', label: 'Схемы' },
  { key: 'modes',   label: 'Режимы' },
];

export function SchemaInfoContent({ initialTab, highlight }: { initialTab?: Tab; highlight?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'needs');
  return (
    <div className="ss-pane">
      <div className="ds-tabs ss-tabs">
        {SCHEMA_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`ds-tab${tab === t.key ? ' is-active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'needs'   && <NeedsTab />}
      {tab === 'schemas' && <SchemasTab highlight={highlight} />}
      {tab === 'modes'   && <ModesTab />}
      <TherapyNote />
    </div>
  );
}

/* ─── Main Component ─── */
export type SchemaInfoTab = 'needs' | 'schemas' | 'modes';
interface Props { onClose: () => void; ratings?: Record<string, number>; autoStartTest?: boolean; initialTab?: SchemaInfoTab; highlightSchema?: string }

export function SchemaInfoSheet({ onClose, ratings, autoStartTest, initialTab, highlightSchema: initHighlight }: Props) {
  const goBack = useHistorySheet(onClose); const tr = useTr();
  const [showTest, setShowTest] = useState(autoStartTest ?? false);
  const [contentKey, setContentKey] = useState(0);
  const [contentInitialTab, setContentInitialTab] = useState<Tab>(initialTab ?? 'needs');
  const hasResult   = !!localStorage.getItem(YSQ_RESULT_KEY);
  const hasProgress = !!localStorage.getItem(YSQ_PROGRESS_KEY);
  const [highlightSchema, setHighlightSchema] = useState<string | undefined>(initHighlight);

  const handleViewSchemas = (schemaName?: string) => {
    setContentInitialTab('schemas');
    setHighlightSchema(schemaName);
    setContentKey(k => k + 1);
    setShowTest(false);
  };

  return (
    <>
      <SsSheet onBack={goBack} zIndex={80}>
        <SsHead eyebrow="Схема-терапия" title={<>Как это <i>работает</i></>} />

        <SchemaInfoContent key={contentKey} initialTab={contentInitialTab} highlight={highlightSchema} />

        <div className="ss-stack">
          {hasProgress && !hasResult && (
            <div
              onClick={() => setShowTest(true)}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTest(true); } }}
              className="ds-card ds-card--warn ds-card--hover ss-cta"
            >
              <span aria-hidden="true">⏸</span>
              <div className="ss-cta-text">
                <div className="ss-need-title">Незаконченный тест</div>
                <div className="ds-sub">{tr('Нажми, чтобы продолжить с места остановки', 'Нажмите, чтобы продолжить с места остановки')}</div>
              </div>
              <span className="ss-cta-arrow">›</span>
            </div>
          )}
          <div
            onClick={() => setShowTest(true)}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTest(true); } }}
            className="ds-card ds-card--hover ss-cta"
          >
            <div className="ss-cta-text">
              <div className="ss-cta-title">
                {hasResult ? 'Мои результаты теста' : hasProgress ? 'Продолжить тест' : 'Пройти тест на схемы'}
              </div>
              <div className="ds-sub">
                {hasResult ? 'Посмотреть или пройти заново' : '116 вопросов · ~10 минут'}
              </div>
            </div>
            <span className="ss-cta-arrow">›</span>
          </div>
        </div>
      </SsSheet>

      {showTest && (
        <Suspense fallback={null}>
          <YSQTestSheet
            onClose={() => setShowTest(false)}
            ratings={ratings}
            autoResume={autoStartTest}
            onViewSchemas={(name) => handleViewSchemas(name)}
          />
        </Suspense>
      )}
    </>
  );
}
