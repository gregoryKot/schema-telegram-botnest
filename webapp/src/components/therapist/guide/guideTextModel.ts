// Разбор текста листа справочника для показа: метки книг — в конец абзаца, длинный пункт — первой фразой.

/** Текст без меток книг и сами метки по порядку, без повторов: метка «[Арнтц ПРЛ, гл. 9]» уходит из фразы в тихую строку
 *  в конце абзаца (Cited), расшифровка — на вкладке «Теория» (sources.ts). */
export function liftCites(text: string): { text: string; cites: string[] } {
  const cites = [...new Set([...text.matchAll(/\[([^[\]]+)\]/g)].map((m) => m[1].trim()))];
  return { text: text.replace(/[ \t]*\[[^[\]]+\]/g, ''), cites };
}

/** Пункт короче — показывается целиком: свёртка ради одной строки только мешает. */
const FOLD_MIN = 220;
const REST_MIN = 60;

/**
 * Первая фраза длинного пункта и остаток — для свёртки «ещё». Конец фразы — точка, «!», «?» или «…»
 * вне скобок перед заглавной, кавычкой или скобкой; «гл. 9» и «т. е.» фразу не рвут. Короткий пункт или
 * пункт одной фразой — `null`, показывается целиком.
 */
export function foldFirstSentence(text: string): { head: string; rest: string } | null {
  if (text.length < FOLD_MIN) return null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[' || ch === '(') depth++;
    else if ((ch === ']' || ch === ')') && depth > 0) depth--;
    else if (depth === 0 && '.!?…'.includes(ch) && /^\s+[«"([A-ZА-ЯЁ]/.test(text.slice(i + 1, i + 4))) {
      // Метка книги сразу за точкой («…противоядие. [Арнтц, 8.1] Если…») остаётся с первой фразой.
      const tail = text.slice(i + 1).match(/^(\s*\[[^[\]]+\][.!?…]?)?/)![0];
      const end = i + 1 + tail.length;
      const head = text.slice(0, end).trim();
      const rest = text.slice(end).trim();
      return rest.length >= REST_MIN ? { head, rest } : null;
    }
  }
  return null;
}
