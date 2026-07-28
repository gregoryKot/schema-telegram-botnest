import { SCHEMA_DOMAINS } from '../../schemaTherapyData';

// Шаг «Схемы» дневника схем (webapp): чипы по доменам + «Только мои/Показать
// все» + текст «откуда это знакомо» на том же экране. Вынесено из
// SchemaEntrySheet — файл-источник пробивал потолок 300 строк (правило №10
// CLAUDE.md). Разметка — существующие классы webapp, перенесены как есть.
export function SchemaChipsStep({
  schemaIds,
  onToggle,
  activeSchemaIds,
  showAllSchemas,
  onToggleShowAll,
  origin,
  onOriginChange,
  originPlaceholder,
}: {
  schemaIds: string[];
  onToggle: (id: string) => void;
  activeSchemaIds?: string[];
  showAllSchemas: boolean;
  onToggleShowAll: () => void;
  origin: string;
  onOriginChange: (v: string) => void;
  originPlaceholder: string;
}) {
  const hasPersonalSchemas = activeSchemaIds && activeSchemaIds.length > 0;
  const useFiltered = hasPersonalSchemas && !showAllSchemas;

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
          <div key={domain.id} style={{ marginBottom: 18 }}>
            <div
              className="chip-section-eyebrow"
              style={{ color: domain.color }}
            >
              <span className="dot" style={{ background: domain.color }} />
              {domain.domain}
            </div>
            <div className="chip-row" style={{ marginBottom: 0 }}>
              {schemas.map((s) => {
                const sel = schemaIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    className={'chip-pill ' + (sel ? 'is-selected' : '')}
                    style={
                      sel
                        ? ({
                            '--pill-color': domain.color + '15',
                            '--pill-fg': domain.color,
                            '--pill-border': domain.color + '50',
                          } as React.CSSProperties)
                        : undefined
                    }
                    onClick={() => onToggle(s.id)}
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
      <textarea
        className={'paper-area ' + (origin.trim() ? 'is-filled' : '')}
        rows={2}
        value={origin}
        onChange={(e) => onOriginChange(e.target.value)}
        placeholder={originPlaceholder}
        style={{ marginTop: 12 }}
      />
    </>
  );
}
