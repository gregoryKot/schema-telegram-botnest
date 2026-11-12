import { MODE_GROUPS, SCHEMA_DOMAINS } from '../../../schemaTherapyData';
import { domainLook, modeLook } from '../../../../../shared/src/theme/entityLook';
import { ConceptTag } from '../../../../../shared/src/therapy/conceptGraph/conceptPaper';

// Спокойный вид карточек «Поля»: только выбранное, без кнопок-переключателей — белые чипы со
// знаком домена (схема) или группы режима, как в сводке «Коротко». Ничего не выбрано — ничего нет.
export function SelectedSchemas({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="tcp-chips">
      {SCHEMA_DOMAINS.flatMap((domain) =>
        domain.schemas
          .filter((s) => ids.includes(s.id))
          .map((s) => <ConceptTag key={s.id} sign={domainLook(domain.id)?.sign}>{s.name}</ConceptTag>),
      )}
    </div>
  );
}

export function SelectedModes({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="tcp-chips">
      {MODE_GROUPS.flatMap((group) =>
        group.items
          .filter((m) => ids.includes(m.id))
          .map((m) => <ConceptTag key={m.id} sign={modeLook(m.id, group.id).sign}>{m.name}</ConceptTag>),
      )}
    </div>
  );
}
