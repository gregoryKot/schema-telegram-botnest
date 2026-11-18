import { normalizeSearchText } from '../utils/searchNormalize';
import { textTokens } from './searchQuery';

/**
 * Вес строки общего поиска (палитра ⌘K) по запросу: чем точнее совпало название, тем выше строка.
 * Слова запроса сверяются со словами названия по стему (падеж не важен) и без стоп-фильтра:
 * «клиент» и «режим» обязаны находить разделы и действия. Регистр и «ё/е» не различаются.
 */
export const ROW_SCORE = {
  starts: 5,
  wordStarts: 4,
  contains: 3,
  stems: 2,
  text: 1,
  none: 0,
} as const;

const isLetter = (ch: string) => /[a-zа-я0-9]/.test(ch);

/** Все слова запроса — начала слов текста (по стему). Запрос без слов не подходит. */
function stemsMatch(text: string, query: string): boolean {
  const words = textTokens(query);
  const tokens = textTokens(text);
  return (
    words.length > 0 &&
    words.every((q) => tokens.some((t) => t.stem.startsWith(q.stem)))
  );
}

/**
 * Вес строки: `label` — название, `text` — подзаголовок и прочий текст поиска.
 * 0 — строка не подходит; пустой запрос подходит всем с наименьшим весом.
 */
export function rowScore(label: string, text: string, query: string): number {
  const q = normalizeSearchText(query.trim());
  if (q === '') return ROW_SCORE.text;
  const name = normalizeSearchText(label);
  if (name.startsWith(q)) return ROW_SCORE.starts;
  for (let at = name.indexOf(q); at !== -1; at = name.indexOf(q, at + 1)) {
    if (!isLetter(name[at - 1])) return ROW_SCORE.wordStarts;
  }
  if (name.includes(q)) return ROW_SCORE.contains;
  if (stemsMatch(label, query)) return ROW_SCORE.stems;
  return normalizeSearchText(text).includes(q) ||
    stemsMatch(`${label} ${text}`, query)
    ? ROW_SCORE.text
    : ROW_SCORE.none;
}

/** Строки с весом по убыванию; при равном весе порядок входа сохраняется. Неподходящие выпадают. */
export function rankRows<T>(
  rows: readonly T[],
  query: string,
  texts: (row: T) => { label: string; text: string },
): { row: T; score: number }[] {
  return rows
    .map((row) => ({
      row,
      score: rowScore(texts(row).label, texts(row).text, query),
    }))
    .filter((r) => r.score > ROW_SCORE.none)
    .sort((a, b) => b.score - a.score);
}
