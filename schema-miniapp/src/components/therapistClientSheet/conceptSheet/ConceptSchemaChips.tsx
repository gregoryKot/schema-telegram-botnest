import { SectionLabel } from '../../SectionLabel';
import { SCHEMA_DOMAINS } from '../../../schemaTherapyData';
import { IdentityDot } from '../../../../../shared/src/components/IdentityDot';
import { colorMix } from '../../../../../shared/src/utils/colorMix';

/**
 * Чипы «Актуальные схемы (ЭДС)» вида «Поля» по доменам: активные — подложкой,
 * пришедшие из YSQ — рамкой. Вынесено из ConceptFieldsView (правило №10).
 * Подложки — color-mix: цвет домена — токен `var(--accent-*)`, а склейка
 * токена с hex-суффиксом альфы даёт невалидный CSS.
 */
export function ConceptSchemaChips({
  activeSchemaIds,
  ysqSchemaIds,
  onToggle,
}: {
  activeSchemaIds: string[];
  ysqSchemaIds: string[];
  onToggle: (id: string) => void;
}) {
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
                  onClick={() => onToggle(schema.id)}
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
    </>
  );
}
