import { useEffect, useState, lazy, Suspense } from 'react';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useYsqLocalState } from '../../../shared/src/hooks/ysqProgressStore';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';
import { useYsqRequested } from '../../../shared/src/tasks/ysqRequestMark';
import { ModesTab } from './schemaInfoSheet/ModesTab';
import { NeedsTab } from './schemaInfoSheet/NeedsTab';
import { SchemasTab } from './schemaInfoSheet/SchemasTab';
import { YsqEntryTile } from './schemaInfoSheet/YsqEntryTile';
import { SsSheet } from './schemaSheets/SsSheet';
import { EntitySheet } from './paper/EntitySheet';

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
  const goBack = useHistorySheet(onClose);
  // Тест «сразу» (из «Ещё», задания) встаёт следующим коммитом, после записи истории справочника: в одном
  // коммите оба листа писали запись от одного и того же location, и «Читать карточку схемы» из результата
  // закрывало оба листа вместо перехода к схеме (стенд b16, diary-library-highlight).
  const [showTest, setShowTest] = useState(false);
  useEffect(() => {
    if (!autoStartTest) return;
    const t = setTimeout(() => setShowTest(true));
    return () => clearTimeout(t);
  }, [autoStartTest]);
  const [contentKey, setContentKey] = useState(0);
  const [contentInitialTab, setContentInitialTab] = useState<Tab>(initialTab ?? 'needs');
  // Под открытым результатом теста карточка не зовёт «Незаконченный тест» (QA 2026-11).
  const { hasResult, hasProgress } = useYsqLocalState();
  const ysqRequested = useYsqRequested(api.getTasks); // задание терапевта (К1, QA 2026-11)
  const [highlightSchema, setHighlightSchema] = useState<string | undefined>(initHighlight);

  // Тест к этому моменту уже закрыт своим goBack (YSQTestSheet): его запись истории снята.
  const handleViewSchemas = (schemaName?: string) => {
    setContentInitialTab('schemas');
    setHighlightSchema(schemaName);
    setContentKey(k => k + 1);
  };

  // Справочник — раздел со своим героем (редизайн 2026-11): лист схем (глина, Layers) с входом в тест
  // внутри; на компьютере — разворот, лист слева колонкой, вкладки справа (SpreadLayout).
  const hero = (
    <EntitySheet look="schemas" label="Схема-терапия" title={<>Как это <i>работает</i></>} titleAs="h1" className="ss-hero ss-lib-hero">
      <YsqEntryTile state={{ hasResult, hasProgress, requested: ysqRequested }} onOpen={() => setShowTest(true)} />
    </EntitySheet>
  );

  return (
    <>
      <SsSheet onBack={goBack} zIndex={80} spread hero={hero}>
        <SchemaInfoContent key={contentKey} initialTab={contentInitialTab} highlight={highlightSchema} />
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
