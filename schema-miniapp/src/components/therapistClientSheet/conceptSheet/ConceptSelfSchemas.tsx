import { ALL_SCHEMAS } from '../../../schemaTherapyData';
import { IdentityDot } from '../../../../../shared/src/components/IdentityDot';

/**
 * Плашка «Схемы клиента (самооценка)» в листе концептуализации: схемы, которые
 * клиент отметил у себя сам. Вынесено из ConceptSheet (правило №10), только
 * чтение; без схем не рисуется.
 */
export function ConceptSelfSchemas({ schemaIds }: { schemaIds: string[] }) {
  if (schemaIds.length === 0) return null;
  return (
    <div
      style={{
        background: 'rgba(var(--fg-rgb),0.03)',
        border: '1px solid rgba(var(--fg-rgb),0.07)',
        borderRadius: 'var(--r-14)',
        padding: '10px 14px',
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.07em',
          color: 'var(--text-sub)',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Схемы клиента (самооценка)
      </div>
      <div className="u-wrap5">
        {schemaIds.map((id) => {
          const schema = ALL_SCHEMAS.find((s) => s.id === id);
          return schema ? (
            <span
              key={id}
              style={{
                fontSize: 11,
                padding: '3px 9px',
                borderRadius: 'var(--r-20)',
                background: 'rgba(var(--fg-rgb),0.07)',
                color: 'var(--text-sub)',
              }}
            >
              <IdentityDot color={schema.domainColor} size={7} /> {schema.name}
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}
