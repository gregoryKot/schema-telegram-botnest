import { haptic } from '../../haptic';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { DiaryTextArea } from './DiaryTextArea';
import { SelectableChip } from './SelectableChip';

// Шаг «Схемы» дневника схем: чипы по доменам + «Только мои/Показать все» +
// текст «откуда это знакомо» на том же экране. Вынесено из SchemaEntrySheet
// в подкомпонент визарда (правило №10 CLAUDE.md).
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
    <div>
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
              {schemas.map((s) => (
                <SelectableChip
                  key={s.id}
                  label={s.name}
                  selected={schemaIds.includes(s.id)}
                  color={domain.color}
                  onClick={() => onToggle(s.id)}
                  radius={16}
                  padding="5px 10px"
                  fontSize={12}
                />
              ))}
            </div>
          </div>
        );
      })}
      {hasPersonalSchemas && (
        <button
          onClick={() => {
            haptic.tap();
            onToggleShowAll();
          }}
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
      <DiaryTextArea
        value={origin}
        onChange={onOriginChange}
        placeholder={originPlaceholder}
        rows={2}
      />
    </div>
  );
}
