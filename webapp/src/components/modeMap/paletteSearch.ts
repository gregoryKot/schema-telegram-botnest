import type { ModeGroup, SchemaDomain } from '../../schemaTherapyData';

interface TherapistCustomModeLike { name: string }

/** Нормализованный запрос поиска: без пробелов по краям, в нижнем регистре. */
export const normalizeQuery = (search: string): string => search.trim().toLowerCase();

/** Режимы группы, совпавшие с запросом по названию или краткому описанию. Пустой запрос — все. */
export function matchGroupItems(group: ModeGroup, q: string): ModeGroup['items'] {
  if (!q) return group.items;
  return group.items.filter(i => i.name.toLowerCase().includes(q) || i.short.toLowerCase().includes(q));
}

/** Схемы домена, совпавшие с запросом по названию. Пустой запрос — все. */
export function matchDomainSchemas(domain: SchemaDomain, q: string): SchemaDomain['schemas'] {
  if (!q) return domain.schemas;
  return domain.schemas.filter(s => s.name.toLowerCase().includes(q));
}

/** Свои режимы терапевта, совпавшие по названию. Пустой запрос — все. */
export function matchCustomModes<T extends TherapistCustomModeLike>(list: T[], q: string): T[] {
  return q ? list.filter(m => m.name.toLowerCase().includes(q)) : list;
}

/** Фигуры «Триггер» и «Поведение» ищутся по ключевым словам подписи. */
export const matchesTrigger = (q: string) => !q || 'триггер ситуация'.includes(q);
export const matchesBehavior = (q: string) => !q || 'поведение последствие'.includes(q);
