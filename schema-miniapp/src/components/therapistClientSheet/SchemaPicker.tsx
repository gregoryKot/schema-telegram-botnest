import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { SectionLabel } from '../SectionLabel';

interface Props {
  activeSchemaIds: string[];
  ysqSchemaIds: string[];
  toggleSchemaId: (id: string) => void;
}

export function SchemaPicker({
  activeSchemaIds,
  ysqSchemaIds,
  toggleSchemaId,
}: Props) {
  return (
    <>
      <SectionLabel mb={8}>Актуальные схемы (ЭДС)</SectionLabel>
      {SCHEMA_DOMAINS.map((domain) => (
        <div key={domain.id} style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.07em',
              color: domain.color + 'aa',
              textTransform: 'uppercase',
              marginBottom: 5,
              paddingLeft: 2,
            }}
          >
            {domain.domain}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {domain.schemas.map((schema) => {
              const active = activeSchemaIds.includes(schema.id);
              const fromYsq = ysqSchemaIds.includes(schema.id);
              return (
                <button
                  key={schema.id}
                  onClick={() => toggleSchemaId(schema.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 20,
                    cursor: 'pointer',
                    border: fromYsq
                      ? `1px solid ${domain.color}55`
                      : '1px solid transparent',
                    background: active
                      ? domain.color + '30'
                      : 'rgba(var(--fg-rgb),0.05)',
                    color: active ? domain.color : 'rgba(var(--fg-rgb),0.45)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                  title={schema.desc}
                >
                  {schema.emoji} {schema.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
