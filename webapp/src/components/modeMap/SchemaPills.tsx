import { getSchemaById } from '../../schemaTherapyData';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { useModeMapConcept, useSchemasOnCanvas } from './clientConceptContext';
import { MAX_SCHEMA_PILLS, linkedSchemaIds, nodeSchemaIds } from './nodeSchemaIds';

interface Props { modeId?: string; schemaId?: string; light?: boolean; fontSize: number }

/** Таблетки схем под текстом узла: максимум три, остальные — «+N». Только чтение. */
export function SchemaPills({ modeId, schemaId, light, fontSize }: Props) {
  const ids = nodeSchemaIds(schemaId, linkedSchemaIds(useModeMapConcept(), modeId, useSchemasOnCanvas()));
  if (ids.length === 0) return null;
  const rest = ids.length - MAX_SCHEMA_PILLS;
  const pill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', maxWidth: '100%',
    padding: '2px 7px', borderRadius: 999, fontSize, lineHeight: 1.2,
  };
  return (
    <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'var(--space-4)' }}>
      {ids.slice(0, MAX_SCHEMA_PILLS).map(id => {
        const s = getSchemaById(id)!;
        return (
          <div key={id} style={{ ...pill,
            background: light ? 'rgba(255,255,255,0.18)' : `color-mix(in srgb, ${s.domainColor} 14%, transparent)`,
            border: `1px solid ${light ? 'rgba(255,255,255,0.3)' : `color-mix(in srgb, ${s.domainColor} 40%, transparent)`}`,
            color: light ? 'rgba(255,255,255,0.92)' : s.domainColor }}>
            <IdentityDot color={s.domainColor} size={7} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
          </div>
        );
      })}
      {rest > 0 && (
        <div style={{ ...pill, border: `1px solid ${light ? 'rgba(255,255,255,0.3)' : 'var(--line)'}`,
          color: light ? 'rgba(255,255,255,0.92)' : 'var(--text-sub)' }}>+{rest}</div>
      )}
    </div>
  );
}
