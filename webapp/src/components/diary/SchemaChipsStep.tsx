import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { SignChip } from '../paper/SignChip';
import { SignArt } from '../art/SignArt';
import { GlyphChevron } from '../exercises/ExGlyphs'; // не через ExScreen: шаг есть и в быстрой записи, без ExScreen
import { domainLook } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';
import '../../styles/sheet-diary.css';

// Шаг «Схемы» дневника схем (webapp): чипы по доменам + «Только мои/Показать все». Вынесено из
// SchemaEntrySheet (правило №10). Подпись домена — знак домена (domainLook), выбранная схема — SignChip домена.
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
        const schemas = useFiltered ? domain.schemas.filter((s) => activeSchemaIds?.includes(s.id) ?? false) : domain.schemas;
        if (schemas.length === 0) return null;
        const look = domainLook(domain.id);
        return (
          <div key={domain.id} className="sd-group">
            <div className="ds-label sd-group-label">
              {look && <span aria-hidden="true"><SignArt sign={look.sign} size="row" /></span>}
              {glue(domain.domain)}
            </div>
            <div className="sd-chips">
              {schemas.map((s) => (
                <SignChip key={s.id} label={s.name} hue={look?.hue} on={schemaIds.includes(s.id)} onToggle={() => onToggle(s.id)} />
              ))}
            </div>
          </div>
        );
      })}
      {hasPersonalSchemas && (
        <button onClick={onToggleShowAll} className="ds-link sd-show-all" aria-expanded={showAllSchemas}>
          <GlyphChevron up={showAllSchemas} />
          {showAllSchemas ? 'Только мои' : 'Показать все'}
        </button>
      )}
    </>
  );
}
