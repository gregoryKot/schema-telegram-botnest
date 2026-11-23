// Разбор текста листа справочника для показа: метки книг тише текста, длинный пункт — первой фразой, подписи оглавления.

/** Кусок текста: обычный или метка книги «[Арнтц ПРЛ, гл. 9]» вместе с пробелом перед ней. */
export interface TextPart { text: string; cite: boolean }

/** Делит текст на обычные куски и метки в квадратных скобках (их же расшифровывает sources.ts). */
export function splitCites(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const m of text.matchAll(/\s*\[[^[\]]+\]/g)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index), cite: false });
    parts.push({ text: m[0], cite: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), cite: false });
  return parts;
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
    else if (depth === 0 && '.!?…'.includes(ch) && /^\s+[«"(\[A-ZА-ЯЁ]/.test(text.slice(i + 1, i + 4))) {
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

/** Короткие подписи чипов оглавления; остальные разделы — своей подписью. */
const TOC_SHORT: Record<string, string> = {
  'Как это звучит': 'Звучит',
  'Как работать': 'Каналы',
  'Между сессиями': 'Дома',
};

export function tocLabel(title: string): string {
  return TOC_SHORT[title] ?? title;
}
