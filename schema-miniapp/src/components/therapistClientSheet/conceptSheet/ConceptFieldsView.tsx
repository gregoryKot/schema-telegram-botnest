import { SectionLabel } from '../../SectionLabel';
import { SCHEMA_DOMAINS } from '../../../schemaTherapyData';
import { IdentityDot } from '../../../../../shared/src/components/IdentityDot';
import { ConceptModePicker } from '../../../../../shared/src/therapy/conceptGraph/ConceptModePicker';
import { colorMix } from '../../../../../shared/src/utils/colorMix';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { CONCEPT_FIELD_TEXT_MAX } from '../../../../../shared/src/limits/textLimits';
import { CONCEPT_FIELDS } from '../helpers';
import type { ClientDetail } from '../types';

/**
 * Вид «Поля» листа концептуализации: актуальные схемы (ЭДС), карта режимов и
 * текстовые поля. Вынесено из ConceptSheet (правило №10), поведение не
 * менялось. Подложки схем — color-mix: цвет домена — токен `var(--accent-*)`,
 * а склейка токена с hex-суффиксом альфы даёт невалидный CSS. Текстовые поля —
 * с пределом сервера и счётчиком (инцидент 2026-10-26, пара сайту).
 */
export function ConceptFieldsView({ detail }: { detail: ClientDetail }) {
  const {
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
      <SectionLabel mb={8}>Актуальные схемы (ЭДС)</SectionLabel>
      {SCHEMA_DOMAINS.map((domain) => (
        <div key={domain.id} className="u-mb10">
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              color: colorMix(domain.color, 67),
              textTransform: 'uppercase',
              marginBottom: 'var(--space-6)',
              paddingLeft: 2,
            }}
          >
            {domain.domain}
          </div>
          <div className="u-wrap5">
            {domain.schemas.map((schema) => {
              const active = activeSchemaIds.includes(schema.id);
              const fromYsq = ysqSchemaIds.includes(schema.id);
              return (
                <button
                  key={schema.id}
                  onClick={() => toggleSchemaId(schema.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--r-20)',
                    cursor: 'pointer',
                    border: fromYsq
                      ? `1px solid ${colorMix(domain.color, 33)}`
                      : '1px solid transparent',
                    background: active
                      ? colorMix(domain.color, 19)
                      : 'rgba(var(--fg-rgb),0.05)',
                    color: active ? domain.color : 'rgba(var(--fg-rgb),0.45)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                  title={schema.desc}
                >
                  <IdentityDot color={domain.color} size={7} /> {schema.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 6 }}>
        <SectionLabel mb={8}>Карта режимов</SectionLabel>
      </div>
      <ConceptModePicker
        activeModeIds={activeModeIds}
        onToggle={toggleModeId}
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
