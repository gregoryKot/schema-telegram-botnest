import { SCHEMA_DOMAINS } from '../../schemaTherapy/schemaTherapyData';
import { ConceptToggleChip } from './ConceptToggleChip';
import { hintStyle } from './graphStyles';

/**
 * Выбор схем: пилюли по доменам. Единственная копия на «+ схема» схемы случая
 * и на поле «Какие схемы включают режим» (правило «одна механика — один
 * компонент»). `onlyIds` — показать только эти схемы (поле режима по умолчанию
 * показывает схемы концептуализации); `domainTitles` — подписи доменов.
 */
export function ConceptSchemaPicker({
  activeIds,
  onToggle,
  onlyIds,
  domainTitles = true,
}: {
  activeIds: string[];
  onToggle: (id: string) => void;
  onlyIds?: ReadonlySet<string>;
  domainTitles?: boolean;
}) {
  return (
    <>
      {SCHEMA_DOMAINS.map((domain) => {
        const schemas = domain.schemas.filter(
          (s) => !onlyIds || onlyIds.has(s.id),
        );
        if (schemas.length === 0) return null;
        return (
          <div key={domain.id} style={{ marginBottom: 'var(--space-6)' }}>
            {domainTitles && (
              <div style={{ ...hintStyle, marginBottom: 4 }}>
                {domain.domain}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-6)',
              }}
            >
              {schemas.map((s) => (
                <ConceptToggleChip
                  key={s.id}
                  label={s.name}
                  color={domain.color}
                  active={activeIds.includes(s.id)}
                  onClick={() => onToggle(s.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
