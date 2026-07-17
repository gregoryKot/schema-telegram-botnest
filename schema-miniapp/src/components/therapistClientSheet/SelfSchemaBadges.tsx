import { SCHEMA_DOMAINS } from '../../schemaTherapyData';

interface Props {
  selfSchemaIds: string[];
}

export function SelfSchemaBadges({ selfSchemaIds }: Props) {
  return (
    selfSchemaIds.length > 0 && (
      <div
        style={{
          background: 'rgba(var(--fg-rgb),0.03)',
          border: '1px solid rgba(var(--fg-rgb),0.07)',
          borderRadius: 14,
          padding: '10px 14px',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.07em',
            color: 'var(--text-sub)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Схемы клиента (самооценка)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {selfSchemaIds.map((id) => {
            const schema = SCHEMA_DOMAINS.flatMap((d) => d.schemas).find(
              (s) => s.id === id,
            );
            return schema ? (
              <span
                key={id}
                style={{
                  fontSize: 11,
                  padding: '3px 9px',
                  borderRadius: 20,
                  background: 'rgba(var(--fg-rgb),0.07)',
                  color: 'var(--text-sub)',
                }}
              >
                {schema.emoji} {schema.name}
              </span>
            ) : null;
          })}
        </div>
      </div>
    )
  );
}
