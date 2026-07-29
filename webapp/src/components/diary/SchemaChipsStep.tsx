import { SCHEMA_DOMAINS } from '../../schemaTherapyData';

// Шаг «Схемы» дневника схем (webapp): только чипы по доменам + «Только
// мои/Показать все». Вынесено из SchemaEntrySheet — файл-источник пробивал
// потолок 300 строк (правило №10 CLAUDE.md). Разметка — существующие классы
// webapp, перенесены как есть.
// Свободный текст («откуда это знакомо») рендерит РОДИТЕЛЬ: правило №7 —
// поле свободного текста живёт в файле, который прогоняет detectCrisisAny
// (инвариант src/security/crisis-path.invariants.spec.ts).
export function SchemaChipsStep({
  schemaIds,
  onToggle,
  activeSchemaIds,
  showAllSchemas,
  onToggleShowAll,
}: {
  schemaIds: string[];
  onToggle: (id: string) => void;
  activeSchemaIds?: string[];
  showAllSchemas: boolean;
  onToggleShowAll: () => void;
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
    </>
  );
}
