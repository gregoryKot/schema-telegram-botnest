import { normalizeSearchText } from '../utils/searchNormalize';
import { parseSearchQuery, stemRu, textTokens } from './searchQuery';
import { typoWord } from './typo';

/**
 * Что в строке выдачи совпало с запросом: полуинтервалы в исходном тексте, по возрастанию и без
 * пересечений. Запрос целиком — первое вхождение (лучше в начале слова); иначе по словам: начало
 * слова по стему (падеж не важен) или слово с опечаткой целиком.
 */
export type HitRange = [number, number];

const isLetter = (ch: string | undefined) =>
  ch !== undefined && /[a-zа-я0-9]/.test(ch);

function phraseRange(text: string, q: string): HitRange | null {
  let first = -1;
  for (let at = text.indexOf(q); at !== -1; at = text.indexOf(q, at + 1)) {
    if (!isLetter(text[at - 1])) return [at, at + q.length];
    if (first === -1) first = at;
  }
  return first === -1 ? null : [first, first + q.length];
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i;
}

export function highlightRanges(text: string, query: string): HitRange[] {
  const norm = normalizeSearchText(text);
  const q = normalizeSearchText(query.trim());
  // Нормализация изменила длину — индексы разъехались бы с исходным текстом.
  if (q === '' || norm.length !== text.length) return [];
  const phrase = phraseRange(norm, q);
  if (phrase) return [phrase];
  const parsed = parseSearchQuery(query);
  const terms = parsed.length > 0 ? parsed : textTokens(query);
  const ranges: HitRange[] = [];
  for (const match of norm.matchAll(/[a-zа-я0-9]+/g)) {
    const word = match[0];
    const stem = stemRu(word);
    let length = 0;
    for (const term of terms) {
      if (stem.startsWith(term.stem)) {
        // Беглая гласная («ребёнка» → «ребёнок»): стем не начало слова — слово целиком.
        const shared = word.startsWith(term.stem)
          ? Math.max(term.stem.length, commonPrefix(word, term.word))
          : word.length;
        length = Math.max(length, Math.min(word.length, shared));
      } else if (typoWord(term.word, word)) {
        length = word.length;
      }
    }
    if (length > 0) ranges.push([match.index, match.index + length]);
  }
  return ranges;
}
