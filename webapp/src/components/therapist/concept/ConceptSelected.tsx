import { MODE_GROUPS, SCHEMA_DOMAINS } from '../../../schemaTherapyData';
import { domainLook, modeLook } from '../../../../../shared/src/theme/entityLook';
import { DigestChips } from '../../../../../shared/src/therapy/conceptGraph/DigestChips';

// Спокойный вид карточек «Поля»: только выбранное, без кнопок-переключателей — те же белые чипы, что в сводке
// «Коротко» (DigestChips): знак домена (схема) или группы режима — у первого чипа серии. Ничего не выбрано — ничего нет.
export function SelectedSchemas({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  const items = SCHEMA_DOMAINS.flatMap((domain) =>
    domain.schemas.filter((s) => ids.includes(s.id)).map((s) => ({ text: s.name, sign: domainLook(domain.id)?.sign })),
  );
  return <DigestChips items={items} />;
}

export function SelectedModes({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  const items = MODE_GROUPS.flatMap((group) =>
    group.items.filter((m) => ids.includes(m.id)).map((m) => ({ text: m.name, sign: modeLook(m.id, group.id).sign })),
  );
  return <DigestChips items={items} />;
}
