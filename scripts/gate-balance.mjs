// Баланс скобок для гейтов, которые вырезают тело метода, catch-ветки или
// аргумент вызова из исходника TS. Строки и шаблонные литералы источником
// скобок не считаются. Комментарии вызывающий стирает заранее
// (gate-strip-comments.mjs или своим стриппером, сохраняя переводы строк).
// Общий модуль, чтобы check-cron-leader и check-dead-end-report не держали
// по копии сканера; gate-sandbox.ts копирует его в песочницу сам.

/** Индекс символа, идущего после строкового/шаблонного литерала, начинающегося в i. */
export function skipString(src, i) {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === quote) return j;
    j += 1;
  }
  return j;
}

/** Индекс закрывающей скобки `close`, парной открывающей на openIndex. */
export function matchPair(src, openIndex, open, close) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i); continue; }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export const matchParen = (src, i) => matchPair(src, i, '(', ')');
export const matchBrace = (src, i) => matchPair(src, i, '{', '}');

/** Номер строки (с 1) символа index. */
export function lineAt(src, index) {
  return src.slice(0, index).split('\n').length;
}
