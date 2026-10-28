import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import type { ClientDetail } from './clientSheetTypes';
import { ClientConceptFields } from './ClientConceptFields';
import { ClientConceptGraph } from './ClientConceptGraph';
import { ConceptVersionHistory } from './concept/ConceptVersionHistory';
import '../../styles/therapist-concept.css';
import { ConceptViewSwitch, useConceptView } from '../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';
import { SaveStatusLine } from '../../../../shared/src/therapy/SaveStatusLine';

interface Props { detail: ClientDetail; onOpenCanvas?: (mapId: number) => void }

export function ClientConceptTab({ detail, onOpenCanvas }: Props) {
  const {
    saveStatus, savedAt, retrySave, exportCopied, handleExport,
    activeSchemaIds, activeModeIds,
    ysqSchemaIds,
  } = detail;
  // Вид выбирается один раз при открытии вкладки (см. useConceptView).
  const [view, setView] = useConceptView(activeModeIds.length);

  return (
    <div className="page-inner-wide u-pt40">
      <div className="ds-head-row tcp-head">
        <div>
          <h2 className="ds-h2">Концептуализация</h2>
          <div className="ds-sub" style={{ marginTop: 4 }}>Схема-карта, цели терапии и связь с детским опытом</div>
        </div>
        <div className="tcp-head-actions">
          <SaveStatusLine className="tcp-save" status={saveStatus} savedAt={savedAt} onRetry={retrySave} align="right" />
          <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={handleExport}>
            ↗ Экспорт{exportCopied ? ' ✓' : ''}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <ConceptViewSwitch view={view} onChange={setView} />
      </div>

      <div className="doc-grid" style={view === 'graph' ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}>
        {view === 'graph' ? (
          <ClientConceptGraph detail={detail} onOpenCanvas={onOpenCanvas} />
        ) : (
          <ClientConceptFields detail={detail} onGoToGraph={() => setView('graph')} />
        )}

        {/* Right sidebar */}
        <aside>
          {/* YSQ cross-reference */}
          {ysqSchemaIds.length > 0 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
              <div className="eyebrow u-mb14">Сверка с YSQ</div>
              <div className="u-col8">
                {ysqSchemaIds.slice(0, 6).map(id => {
                  const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
                  const inConcept = activeSchemaIds.includes(id);
                  return (
                    <div key={id} className="u-ac8">
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{s?.name ?? id}</span>
                      {!inConcept && <span style={{ fontSize: 11, color: 'var(--c-amber)', fontWeight: 500 }}>+ добавить?</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <ConceptVersionHistory detail={detail} />
        </aside>
      </div>
    </div>
  );
}
