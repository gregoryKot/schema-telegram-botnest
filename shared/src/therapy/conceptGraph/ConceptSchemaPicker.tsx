import { SCHEMA_DOMAINS } from '../../schemaTherapy/schemaTherapyData';
import { ConceptToggleChip } from './ConceptToggleChip';
import { ConceptGroupLabel } from './ConceptGroupLabel';
import { DOMAIN_LABEL } from './conceptInlineStyles';
import { DOMAIN_HUE } from '../../theme/entityHue';

/** Выбор схем по доменам: одна копия на «+ схема» и на поле режима. */
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
        const hue = DOMAIN_HUE[domain.id];
        return (
          <div key={domain.id} style={{ marginBottom: 'var(--space-6)' }}>
            {domainTitles && (
              <ConceptGroupLabel hue={hue} fallback={DOMAIN_LABEL}>
                {domain.domain}
              </ConceptGroupLabel>
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
                  hue={hue}
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
