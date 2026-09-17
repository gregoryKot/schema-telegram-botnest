// Генерик русского плюрализма (1/2-4/5+) — до появления карточки «Мой
// портрет» этот выбор был у каждого счётчика свой (pluralEntries/pluralDays/
// dayWord в PatternFrequencyList/локальный plural() в webapp). Новому
// счётчику (схемы, режимы) не нужна ещё одна копия того же switch —
// вычисление слова через функцию-параметр вместо трёх готовых слов, чтобы
// не плодить pluralSchemas/pluralModes рядом с уже существующими.
export function pluralRu(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}
