import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { DOMAIN_HUE, hueStyle } from '../../lib/tone';
import '../../styles/sheet-diary.css';

// Шаг «Схемы» дневника схем (webapp): только чипы по доменам + «Только
// мои/Показать все». Вынесено из SchemaEntrySheet — файл-источник пробивал
// потолок 300 строк (правило №10 CLAUDE.md). Чипы — ds-chip в тоне домена
// (DOMAIN_HUE).
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
          <div key={domain.id} className="sd-group" style={hueStyle(DOMAIN_HUE[domain.id])}>
            <div className="ds-label sd-group-label">
              <i className="ds-dot tone-fill" />
              {domain.domain}
            </div>
            <div className="sd-chips">
              {schemas.map((s) => (
                <button
                  key={s.id}
                  className={'ds-chip sd-chip' + (schemaIds.includes(s.id) ? ' is-selected tone-tint' : '')}
                  onClick={() => onToggle(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {hasPersonalSchemas && (
        <button onClick={onToggleShowAll} className="ds-link sd-show-all">
          {showAllSchemas ? '↑ Только мои' : '↓ Показать все'}
        </button>
      )}
    </>
  );
}
