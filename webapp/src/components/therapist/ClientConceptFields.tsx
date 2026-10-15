import type { ClientConceptualization } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { ConceptModePicker } from '../../../../shared/src/therapy/conceptGraph/ConceptModePicker';
import { CONCEPT_FIELDS } from './clientSheetHelpers';
import type { ClientDetail } from './clientSheetTypes';

// Вид «Поля» вкладки концептуализации: цели, актуальные схемы, карта режимов
// и текстовые поля. Вынесено из ClientConceptTab (правило №10), поведение не
// менялось; выбор режимов — на общем ConceptModePicker (его же берут мини-апп
// и «+ режим» в клетках схемы случая).
export function ClientConceptFields({ detail }: { detail: ClientDetail }) {
  const {
    localConcept,
    patchConcept,
    activeSchemaIds,
    toggleSchemaId,
    activeModeIds,
    toggleModeId,
  } = detail;

  return (
    <div>
      {/* Goals */}
      <div className="section">
        <div className="eyebrow u-mb12">Цели схема-терапии</div>
        <textarea
          className="textarea"
          value={(localConcept.goals as string) ?? ''}
          onChange={(e) => patchConcept({ goals: e.target.value })}
          placeholder="Что должно измениться. Конкретные результаты, на которые направлена работа."
          rows={3}
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            borderColor: 'var(--accent-line)',
          }}
        />
      </div>

      {/* Schema selection */}
      <div className="section">
        <div className="section-head u-mb20">
          <h3>Актуальные схемы</h3>
          <span className="hint">{activeSchemaIds.length} активны из 20</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {SCHEMA_DOMAINS.map((domain) => (
            <div key={domain.id}>
              <div
                className="eyebrow"
                style={{ color: domain.color, marginBottom: 10 }}
              >
                {domain.domain}
              </div>
              <div className="u-wrap8">
                {domain.schemas.map((s) => {
                  const active = activeSchemaIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSchemaId(s.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--r-6)',
                        fontSize: 12.5,
                        fontWeight: active ? 600 : 400,
                        background: active ? domain.color : 'var(--surface-2)',
                        color: active
                          ? 'var(--on-accent)'
                          : 'var(--text-faint)',
                        border: `1px solid ${active ? domain.color : 'var(--line)'}`,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.12s',
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mode selection */}
      <div className="section">
        <div className="section-head u-mb20">
          <h3>Карта режимов</h3>
          <span className="hint">{activeModeIds.length} в работе</span>
        </div>
        <ConceptModePicker
          activeModeIds={activeModeIds}
          onToggle={toggleModeId}
        />
      </div>

      {/* Text fields */}
      {CONCEPT_FIELDS.map((field) => (
        <div key={String(field.key)} className="section">
          <div className="eyebrow u-mb12">{field.label}</div>
          <textarea
            className="textarea"
            value={
              (localConcept[
                field.key as keyof ClientConceptualization
              ] as string) ?? ''
            }
            onChange={(e) => patchConcept({ [field.key]: e.target.value })}
            placeholder={field.placeholder}
            rows={4}
          />
        </div>
      ))}
    </div>
  );
}
