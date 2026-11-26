// Вид записи клиента у терапевта (вкладка «Записи клиента», b31): знак и бумага по типу — те же, что в ленте
// «Записей» у клиента (sections/diary/feedLook.ts, ENTITY_LOOK; принцип 10 — терапевт и клиент говорят одними
// знаками). Дневник и карточка схем — Layers на глине 28, режимов — Cluster на небе 240 (тип, а не группа режима,
// как в ленте), благодарность — Pebbles на бирюзе 195 (не мох 145 старого DIARY_HUE.gratitude) с камешками-данными,
// быстрая запись и всё неизвестное — Pebbles на персике 45.
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { kindLook } from '../../sections/diary/feedLook';

interface NoteLook { hue: number; sign: SignKey; filled?: boolean }

/** Вид записи по её типу: `schema`, `mode`, `gratitude`, остальное — быстрая запись. */
export function noteLook(type: string): NoteLook {
  if (type === 'schema' || type === 'mode') return kindLook(type);
  if (type === 'gratitude') return { ...kindLook('gratitude'), filled: true };
  return kindLook('thought');
}
