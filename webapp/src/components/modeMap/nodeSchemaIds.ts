import { getSchemaById } from '../../schemaTherapyData';

export const MAX_SCHEMA_PILLS = 3;

/** Схемы узла: своя `schemaId` первой, затем схемы из связей режима клиента; без дублей и без неизвестных id. */
export function nodeSchemaIds(schemaId: string | undefined, linked: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of [schemaId, ...linked]) {
    if (id && !out.includes(id) && getSchemaById(id)) out.push(id);
  }
  return out;
}
