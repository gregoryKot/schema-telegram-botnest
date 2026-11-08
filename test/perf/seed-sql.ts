// Кирпичи SQL сидера синтетики (test/perf/seed.ts и шаги, вынесенные из него
// по правилу №10). В SQL подставляются только константы профиля — экранирование
// здесь против кавычек в литералах, а не против чужого ввода.

export const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
export const strs = (xs: readonly string[]) =>
  `ARRAY[${xs.map(q).join(',')}]::text[]`;
export const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
// Элемент массива по номеру строки (PG-массивы с единицы).
export const at1 = (xs: readonly string[], i: string) =>
  `(${strs(xs)})[1 + (${i}) % ${xs.length}]`;
// bigint обязателен: i * 7919 для 2 млн строк не влезает в int4.
export const series = (n: number) =>
  `generate_series(1::bigint, ${n}::bigint) g(i)`;
