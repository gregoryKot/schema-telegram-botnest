// Кирпичи SQL сидера синтетики (test/perf/seed.ts и шаги, вынесенные из него
// по правилу №10). В SQL подставляются только константы профиля — экранирование
// здесь против кавычек в литералах, а не против чужого ввода.
import { PERF_ID_BASE as B, PERF_PROFILE as P } from './seed-profile';

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

// Номер строки → userId: перекос к «активным» (квадрат равномерной доли),
// затем перестановка *4999 (взаимно просто с 10 000), чтобы активными были не
// первые id (терапевты). Модуль 10007 у выбора человека и 1000003 у времени
// (seed-steps.ts) разные простые — иначе человек однозначно определял бы день.
export const pick = (i: string, salt = 0) =>
  `(${B} + 1 + (floor(${P.users} * power(((${i} * 7919 + ${salt}) % 10007) / 10007.0::float8, 2))::bigint * 4999) % ${P.users})`;
// n РАЗНЫХ пользователей (для таблиц с PK/unique по userId): mult взаимно прост с U.
export const distinctUser = (i: string, mult = 4999) =>
  `(${B} + 1 + (${i} * ${mult}) % ${P.users})`;
