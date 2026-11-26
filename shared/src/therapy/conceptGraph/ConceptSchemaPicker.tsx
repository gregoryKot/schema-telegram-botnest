import { SCHEMA_DOMAINS } from '../../schemaTherapy/schemaTherapyData';
import { ConceptToggleChip } from './ConceptToggleChip';
import { ConceptGroup } from './ConceptGroup';
import { domainLook } from '../../theme/entityLook';

/** Выбор схем по доменам: одна копия на «+ схема», поле режима и «Актуальные схемы» вида «Поля». */
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
    <div className={domainTitles ? 'cg-groups' : 'cg-groups cg-groups--flat'}>
      {SCHEMA_DOMAINS.map((domain) => {
        const schemas = domain.schemas.filter(
          (s) => !onlyIds || onlyIds.has(s.id),
        );
        if (schemas.length === 0) return null;
        const look = domainLook(domain.id);
        return (
          <ConceptGroup
            key={domain.id}
            look={look}
            title={domainTitles ? domain.domain : undefined}
          >
            {schemas.map((s) => (
              <ConceptToggleChip
                key={s.id}
                label={s.name}
                color={domain.color}
                hue={look?.hue}
                active={activeIds.includes(s.id)}
                onClick={() => onToggle(s.id)}
              />
            ))}
          </ConceptGroup>
        );
      })}
    </div>
  );
}
