import { SCHEMA_DOMAINS } from '../../schemaTherapyData';

// Выбор схем в дневнике (по доменам) + переключатель «только мои/все».
// Вынесено из SchemaEntrySheet.tsx (правило №10).
export function SchemaPicker({
  schemaIds,
  onToggle,
  useFiltered,
  activeSchemaIds,
  hasPersonalSchemas,
  showAllSchemas,
  onToggleShowAll,
}: {
  schemaIds: string[];
  onToggle: (id: string) => void;
  useFiltered?: boolean;
  activeSchemaIds?: string[];
  hasPersonalSchemas?: boolean;
  showAllSchemas: boolean;
  onToggleShowAll: () => void;
}) {
  return (
    <>
      {SCHEMA_DOMAINS.map((domain) => {
        const schemas = useFiltered
          ? domain.schemas.filter(
              (s) => activeSchemaIds?.includes(s.id) ?? false,
            )
          : domain.schemas;
        if (schemas.length === 0) return null;
        return (
          <div key={domain.id} style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 11,
                color: domain.color,
                fontWeight: 600,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {domain.domain}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {schemas.map((s) => {
                const sel = schemaIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => onToggle(s.id)}
                    className="sel-btn"
                    style={{
                      background: sel
                        ? `${domain.color}33`
                        : 'rgba(var(--fg-rgb),0.06)',
                      border: sel
                        ? `1px solid ${domain.color}`
                        : '1px solid transparent',
                      borderRadius: 16,
                      padding: '5px 10px',
                      color: sel
                        ? 'var(--chip-sel-text)'
                        : 'rgba(var(--fg-rgb),0.6)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {hasPersonalSchemas && (
        <button
          onClick={onToggleShowAll}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-sub)',
            fontSize: 12,
            cursor: 'pointer',
            padding: '4px 0',
            marginBottom: 8,
          }}
        >
          {showAllSchemas ? '↑ Только мои' : '↓ Показать все'}
        </button>
      )}
    </>
  );
}
