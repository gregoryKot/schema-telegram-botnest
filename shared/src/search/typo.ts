import { textTokens, type QueryTerm } from './searchQuery';

/** С какой длины слова запроса прощается опечатка: у коротких слов одна правка даёт другое слово. */
const TYPO_MIN_LENGTH = 5;

/** Строки равны или отличаются одной правкой: вставка, удаление, замена, перестановка соседних букв. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  if (short.length < long.length) return short.slice(i) === long.slice(i + 1);
  return (
    short.slice(i + 1) === long.slice(i + 1) ||
    (short[i] === long[i + 1] &&
      short[i + 1] === long[i] &&
      short.slice(i + 2) === long.slice(i + 2))
  );
}

/** Слово запроса (от 5 букв) — слово текста с одной опечаткой, целиком или недописанное. */
export function typoWord(query: string, word: string): boolean {
  return (
    query.length >= TYPO_MIN_LENGTH &&
    (withinOneEdit(query, word) ||
      withinOneEdit(query, word.slice(0, query.length)))
  );
}

const fits = (q: QueryTerm, t: QueryTerm) =>
  t.stem.startsWith(q.stem) || typoWord(q.word, t.word);

/** Каждое слово запроса находит слово текста: по стему или с одной опечаткой. Запрос без слов — нет. */
export function typoMatch(text: string, query: string): boolean {
  const words = textTokens(query);
  const tokens = textTokens(text);
  return words.length > 0 && words.every((q) => tokens.some((t) => fits(q, t)));
}
