import { ROW_SCORE, rowScore } from './rankRows';

/**
 * Вес строки с учётом поисковых синонимов названия (shared/src/schemaTherapy/searchAliases.ts).
 * Синоним сверяется вместе с названием («злой» + «Сердитый Ребёнок») и весит не больше совпадения
 * по стему: строка, найденная по своему названию, остаётся выше. Опечатка в синониме прощается.
 */
export function aliasScore(
  label: string,
  aliases: readonly string[],
  query: string,
): number {
  if (query.trim() === '') return ROW_SCORE.none;
  const best = aliases.reduce<number>(
    (max, alias) => Math.max(max, rowScore(`${alias} ${label}`, '', query)),
    ROW_SCORE.none,
  );
  return Math.min(best, ROW_SCORE.stems);
}

/** Вес строки: лучшее из совпадения по названию и тексту (rowScore) и по синонимам. */
export function rowScoreWithAliases(
  label: string,
  text: string,
  query: string,
  aliases: readonly string[],
): number {
  return Math.max(
    rowScore(label, text, query),
    aliasScore(label, aliases, query),
  );
}

/** rankRows для строк с синонимами: у строки без синонимов вес тот же, что у rankRows. */
export function rankRowsWithAliases<T>(
  rows: readonly T[],
  query: string,
  texts: (row: T) => {
    label: string;
    text: string;
    aliases?: readonly string[];
  },
): { row: T; score: number }[] {
  return rows
    .map((row) => ({
      row,
      score: rowScoreWithAliases(
        texts(row).label,
        texts(row).text,
        query,
        texts(row).aliases ?? [],
      ),
    }))
    .filter((r) => r.score > ROW_SCORE.none)
    .sort((a, b) => b.score - a.score);
}
