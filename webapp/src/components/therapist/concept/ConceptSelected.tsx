import { MODE_GROUPS, SCHEMA_DOMAINS } from '../../../schemaTherapyData';
import { DOMAIN_HUE, hueStyle } from '../../../lib/tone';
import { ConceptToggleChip } from '../../../../../shared/src/therapy/conceptGraph/ConceptToggleChip';

// Спокойный вид карточек «Поля»: только выбранное, без кнопок-переключателей.
// Схемы — цветом домена (как в полном выборе), режимы — цветом группы.
export function SelectedSchemas({ ids }: { ids: string[] }) {
  return (
    <div className="tcp-chips">
      {SCHEMA_DOMAINS.flatMap((domain) =>
        domain.schemas
          .filter((s) => ids.includes(s.id))
          .map((s) => (
            <span key={s.id} className="tcp-schema-btn tcp-schema-btn--static is-on tone-fill" style={hueStyle(DOMAIN_HUE[domain.id])}>
              {s.name}
            </span>
          )),
      )}
    </div>
  );
}

export function SelectedModes({ ids }: { ids: string[] }) {
  return (
    <div className="tcp-chips">
      {MODE_GROUPS.flatMap((group) =>
        group.items
          .filter((m) => ids.includes(m.id))
          .map((m) => <ConceptToggleChip key={m.id} readOnly active label={m.name} color={group.color} />),
      )}
    </div>
  );
}
