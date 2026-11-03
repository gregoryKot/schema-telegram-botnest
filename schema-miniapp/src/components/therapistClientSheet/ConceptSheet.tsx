import { BottomSheet } from '../BottomSheet';
import { TherapyClientSummary } from '../../api';
import { ClientDetail } from './types';
import { ConceptFieldsView } from './conceptSheet/ConceptFieldsView';
import { ConceptGraphView } from './conceptSheet/ConceptGraphView';
import {
  ConceptViewSwitch,
  useConceptView,
} from '../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';
import {
  ConceptDigest,
  useConceptDigest,
} from '../../../../shared/src/therapy/conceptGraph/ConceptDigest';
import { ConceptHistoryPanel } from './conceptSheet/ConceptHistoryPanel';
import { ConceptYsqHistory } from './conceptSheet/ConceptYsqHistory';
import { YsqRequestButton } from './conceptSheet/YsqRequestButton';
import { ConceptSaveBar } from './conceptSheet/ConceptSaveBar';
import { ConceptSelfSchemas } from './conceptSheet/ConceptSelfSchemas';
import { ConceptExportButton } from './conceptSheet/ConceptExportButton';
interface ConceptSheetProps {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}
export function ConceptSheet({ selectedClient, detail }: ConceptSheetProps) {
  const {
    concept,
    localConcept,
    conceptDirty,
    showHistory,
    setShowHistory,
    setShowConceptSheet,
    selfSchemaIds,
    activeModeIds,
    saveConcept,
  } = detail;
  // Вид выбирается один раз при открытии листа (см. useConceptView).
  const [view, setView] = useConceptView(activeModeIds.length);
  const goToGraph = () => setView('graph'); // ссылка «привязать» из списка схем за режимами
  // Сводка «Коротко» (#902) — над переключателем вида, из тех же данных, что и схема.
  const digestRows = useConceptDigest(concept, localConcept);

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
        <ConceptDigest rows={digestRows} />
        <div className="u-mb12">
          <ConceptViewSwitch view={view} onChange={setView} />
        </div>
        {view === 'graph' ? (
          <ConceptGraphView detail={detail} />
        ) : (
          <ConceptFieldsView detail={detail} onGoToGraph={goToGraph} />
        )}
        <ConceptSaveBar detail={detail} />
        <ConceptExportButton detail={detail} />
      </div>
    </BottomSheet>
  );
}
