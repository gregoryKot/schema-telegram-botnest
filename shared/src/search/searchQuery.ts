import { normalizeSearchText } from '../utils/searchNormalize';

/**
 * Разбор запроса поиска («Справочник» терапевта, палитра ⌘K): вопрос человека → значимые слова со стемом. Служебные слова («как», «с»,
 * «работать», родовые «схема»/«режим»/«клиент») не ищутся: они есть в каждом листе и топят выдачу.
 * Стем — срез падежного окончания без словаря: «схемой» и «схема», «ребёнка» и «ребёнок» дают один стем.
 * Слово подходит тексту, когда его стем — начало стема слова из текста (недописанное слово тоже находит)
 * или само слово — подстрока текста.
 */
export interface QueryTerm {
  word: string;
  stem: string;
}

// Длинные окончания раньше коротких: «ями» срезается целиком, а не как «и».
// prettier-ignore
const ENDINGS = [
  'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ией', 'иях', 'иям',
  'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ый', 'ий', 'ой', 'ей', 'ую', 'юю', 'ых', 'их', 'ым', 'им', 'ом', 'ем',
  'ах', 'ях', 'ам', 'ям', 'ов', 'ев', 'ью', 'ию', 'ия',
  'а', 'я', 'о', 'е', 'у', 'ю', 'ы', 'и', 'ь', 'й',
];
const MIN_STEM = 3;
const CONSONANT = 'бвгджзклмнпрстфхцчшщ';

/** Стем русского слова: без окончания и без беглой гласной («ребёнок» → «ребенк», как у «ребёнка»). */
export function stemRu(word: string): string {
  const ending = ENDINGS.find(
    (e) => word.endsWith(e) && word.length - e.length >= MIN_STEM,
  );
  const stem = ending ? word.slice(0, -ending.length) : word;
  const [before, vowel, last] = stem.slice(-3);
  const fleeting =
    stem.length > MIN_STEM &&
    last === 'к' &&
    (vowel === 'о' || vowel === 'е') &&
    CONSONANT.includes(before);
  return fleeting ? `${stem.slice(0, -2)}к` : stem;
}

// prettier-ignore
const STOP_WORDS = [
  'как', 'что', 'чем', 'где', 'когда', 'зачем', 'почему', 'какой', 'какая', 'какие', 'кто',
  'с', 'со', 'в', 'во', 'на', 'при', 'по', 'для', 'от', 'из', 'у', 'к', 'ко', 'о', 'об', 'про', 'за', 'до', 'над', 'под',
  'и', 'или', 'а', 'но', 'если', 'то', 'же', 'ли', 'не', 'бы', 'вот', 'это', 'этот', 'эта', 'эти', 'этим', 'этой', 'этого', 'этих', 'такой', 'такая', 'таким', 'такие',
  'я', 'мне', 'мой', 'он', 'она', 'они', 'его', 'ее', 'их', 'себя',
  'работать', 'работаю', 'работаем', 'работает', 'работа', 'делать', 'делаю', 'делаем', 'сделать', 'поступать',
  'быть', 'есть', 'нужно', 'можно', 'надо', 'лучше', 'помочь', 'помогать', 'помогает', 'вести',
  'справиться', 'справляться', 'схема', 'режим', 'клиент', 'пациент',
];
const STOP = new Set(STOP_WORDS.flatMap((w) => [w, stemRu(w)]));

const tokenCache = new Map<string, QueryTerm[]>();

/** Слова текста со стемами; тексты справочника статичны, разбор каждого абзаца делается один раз. */
export function textTokens(text: string): QueryTerm[] {
  let tokens = tokenCache.get(text);
  if (!tokens) {
    tokens = normalizeSearchText(text)
      .split(/[^a-zа-я0-9]+/)
      .filter(Boolean)
      .map((word) => ({ word, stem: stemRu(word) }));
    tokenCache.set(text, tokens);
  }
  return tokens;
}

/** Значимые слова запроса: без служебных, каждое — со стемом. Запрос из одних служебных слов — пусто. */
export function parseSearchQuery(query: string): QueryTerm[] {
  const terms = normalizeSearchText(query)
    .split(/[^a-zа-я0-9]+/)
    .filter(Boolean)
    .map((word) => ({ word, stem: stemRu(word) }))
    .filter((t) => !STOP.has(t.word) && !STOP.has(t.stem));
  return terms.filter(
    (t, i) => terms.findIndex((o) => o.stem === t.stem) === i,
  );
}

/** Слово текста (в нормализованном виде), которому подошёл термин: по стему; `loose` — ещё и подстрокой. Нет — null. */
export function findTerm(
  text: string,
  term: QueryTerm,
  loose = true,
): string | null {
  const token = textTokens(text).find((t) => t.stem.startsWith(term.stem));
  if (token) return token.word;
  return loose && normalizeSearchText(text).includes(term.word)
    ? term.word
    : null;
}
