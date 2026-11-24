import type { WorkOption } from './names';

type Group = { title: string; options: WorkOption[] };

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();

/** Поиск по списку «Что делали»: подстрока в названии, пустые группы убираются; пустой запрос — всё как есть. */
export function filterWorkGroups(groups: Group[], query: string): Group[] {
  const q = norm(query);
  if (!q) return groups;
  return groups
    .map((g) => ({ ...g, options: g.options.filter((o) => norm(o.name).includes(q)) }))
    .filter((g) => g.options.length > 0);
}
