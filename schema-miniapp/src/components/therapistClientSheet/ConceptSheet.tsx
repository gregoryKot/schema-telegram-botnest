import { BottomSheet } from '../BottomSheet';
import { TherapyClientSummary } from '../../api';
import { ClientDetail } from './types';
import { ConceptFieldsView } from './conceptSheet/ConceptFieldsView';
import { ConceptGraphView } from './conceptSheet/ConceptGraphView';
import {
  ConceptViewSwitch,
  useConceptView,
} from '../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';
import { ConceptHistoryPanel } from './conceptSheet/ConceptHistoryPanel';
import { ConceptYsqHistory } from './conceptSheet/ConceptYsqHistory';
import { YsqRequestButton } from './conceptSheet/YsqRequestButton';
import { ConceptSaveBar } from './conceptSheet/ConceptSaveBar';
import { ConceptSelfSchemas } from './conceptSheet/ConceptSelfSchemas';
interface ConceptSheetProps {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}
export function ConceptSheet({ selectedClient, detail }: ConceptSheetProps) {
  const {
    concept,
    conceptDirty,
    showHistory,
    setShowHistory,
    setShowConceptSheet,
    exportCopied,
    selfSchemaIds,
    activeModeIds,
    saveConcept,
    handleExport,
  } = detail;
  // Вид выбирается один раз при открытии листа (см. useConceptView).
  const [view, setView] = useConceptView(activeModeIds.length);
  const goToGraph = () => setView('graph'); // ссылка «привязать» из списка схем за режимами

  return (
    <BottomSheet
      onClose={() => {
        if (conceptDirty) void saveConcept();
        setShowConceptSheet(false);
      }}
    >
      <div className="u-pt4">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div className="u-h17">Концептуализация</div>
          {concept && (concept.history as unknown[])?.length > 0 && (
            <button
              onClick={() => setShowHistory((h) => !h)}
              style={{
                background: showHistory
                  ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                  : 'rgba(var(--fg-rgb),0.06)',
                border: 'none',
                borderRadius: 'var(--r-10)',
                padding: '5px 10px',
                color: showHistory ? 'var(--accent)' : 'var(--text-sub)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
              }}
            >
              История ({(concept.history as unknown[]).length})
            </button>
          )}
        </div>
        <ConceptHistoryPanel detail={detail} />
        <YsqRequestButton selectedClient={selectedClient} detail={detail} />
        <ConceptYsqHistory detail={detail} />
        <ConceptSelfSchemas schemaIds={selfSchemaIds} />
        <div className="u-mb12">
          <ConceptViewSwitch view={view} onChange={setView} />
        </div>
        {view === 'graph' ? (
          <ConceptGraphView detail={detail} />
        ) : (
          <ConceptFieldsView detail={detail} onGoToGraph={goToGraph} />
        )}
        <ConceptSaveBar detail={detail} />
        {concept && (
          <button
            onClick={handleExport}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '11px 0',
              borderRadius: 'var(--r-14)',
              border: '1px solid rgba(var(--fg-rgb),0.1)',
              background: exportCopied
                ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                : 'transparent',
              color: exportCopied ? '#06d6a0' : 'rgba(var(--fg-rgb),0.4)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {exportCopied ? '✓ Скопировано' : '↗ Экспорт / Поделиться'}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
