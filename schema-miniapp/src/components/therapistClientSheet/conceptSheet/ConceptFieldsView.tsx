import { SectionLabel } from '../../SectionLabel';
import { ConceptSchemaChips } from './ConceptSchemaChips';
import { ConceptModePicker } from '../../../../../shared/src/therapy/conceptGraph/ConceptModePicker';
import { ModeSchemasList } from '../../../../../shared/src/therapy/conceptGraph/ModeSchemasList';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { CONCEPT_FIELD_TEXT_MAX } from '../../../../../shared/src/limits/textLimits';
import { CONCEPT_FIELDS } from '../helpers';
import type { ClientDetail } from '../types';

/**
 * Вид «Поля» листа концептуализации: актуальные схемы (ЭДС, ConceptSchemaChips),
 * карта режимов и текстовые поля. Вынесено из ConceptSheet (правило №10). Под
 * чипами режимов — схемы за режимами (общий ModeSchemasList, как в
 * ConceptModeCard сайта, правило №3): черновик `localConcept.modeLinks` сильнее
 * серверного; связи здесь только читаются, редактируются в виде «Схема» — туда
 * ведёт onGoToGraph. Текстовые поля — с пределом сервера и счётчиком
 * (инцидент 2026-10-26, пара сайту).
 */
export function ConceptFieldsView({
  detail,
  onGoToGraph,
}: {
  detail: ClientDetail;
  onGoToGraph?: () => void;
}) {
  const {
    concept,
    localConcept,
    activeSchemaIds,
    ysqSchemaIds,
    activeModeIds,
    patchConcept,
    toggleSchemaId,
    toggleModeId,
  } = detail;

  return (
    <>
      <ConceptSchemaChips
        activeSchemaIds={activeSchemaIds}
        ysqSchemaIds={ysqSchemaIds}
        onToggle={toggleSchemaId}
      />
      <div style={{ marginTop: 6 }}>
        <SectionLabel mb={8}>Карта режимов</SectionLabel>
      </div>
      <ConceptModePicker
        activeModeIds={activeModeIds}
        onToggle={toggleModeId}
      />
      <ModeSchemasList
        activeModeIds={activeModeIds}
        modeLinks={localConcept.modeLinks ?? concept?.modeLinks}
        onGoToGraph={onGoToGraph}
      />
      <div className="u-mt8">
        {CONCEPT_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="u-mb12">
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.07em',
                color: 'var(--text-sub)',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-6)',
              }}
            >
              {label}
            </div>
            <LimitedTextarea
              max={CONCEPT_FIELD_TEXT_MAX}
              value={(localConcept[key] as string) ?? ''}
              onChange={(e) => patchConcept({ [key]: e.target.value })}
              placeholder={placeholder}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(var(--fg-rgb),0.04)',
                border: '1px solid rgba(var(--fg-rgb),0.08)',
                borderRadius: 'var(--r-12)',
                padding: '10px 12px',
                outline: 'none',
                resize: 'none',
                color: 'var(--text)',
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: 'inherit',
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
