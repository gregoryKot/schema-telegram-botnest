// Знак строки «что переедет» на /link и /account/merge (docs/design/APP_2026-11.md, «Меню, ⌘K,
// объединение»: `dataKindSign`): таблица переноса → знак сущности (DATA_KIND_ENTITY → ENTITY_LOOK).
import { ENTITY_LOOK, dataKindEntity, type SignKey } from '../../../../shared/src/theme/entityLook';

/** Знак таблицы переноса; незнакомая таблица (сервер новее сайта) — null: строка без знака, а не чужой. */
export function dataKindSign(table: string): SignKey | null {
  const entity = dataKindEntity(table);
  return entity ? ENTITY_LOOK[entity].sign : null;
}
