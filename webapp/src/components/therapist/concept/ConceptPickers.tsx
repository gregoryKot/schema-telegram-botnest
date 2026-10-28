import { SCHEMA_DOMAINS } from '../../../schemaTherapyData';
import { DOMAIN_HUE, hueStyle } from '../../../lib/tone';
import type { ClientDetail } from '../clientSheetTypes';
import { ConceptModeCard } from './ConceptModeCard';

// Выбор актуальных схем и карта режимов (поведение прежнее, вид — карточки);
// onGoToGraph — переход в вид «Схема» из карточки режимов.
export function ConceptPickers({ detail, onGoToGraph }: { detail: ClientDetail; onGoToGraph?: () => void }) {
  const { activeSchemaIds, toggleSchemaId } = detail;
  return (
    <div className="tcp-pickers">
      <section className="ds-card">
        <div className="ds-head-row" style={{ marginBottom: 16 }}>
          <h3 className="ds-h3">Актуальные схемы</h3>
          <span className="ds-sub">{activeSchemaIds.length} активны из 20</span>
        </div>
        <div className="tcp-pickers">
          {SCHEMA_DOMAINS.map((domain) => (
            <div key={domain.id} style={hueStyle(DOMAIN_HUE[domain.id])}>
              <div className="tcp-domain tone-text">{domain.domain}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {domain.schemas.map((s) => {
                  const on = activeSchemaIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSchemaId(s.id)}
                      className={`tcp-schema-btn${on ? ' is-on tone-fill' : ''}`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      <ConceptModeCard detail={detail} onGoToGraph={onGoToGraph} />
    </div>
  );
}
