// Текст рубрики справочника по предложениям — для листа «В план»: рубрику берут целиком или частями.
// Сами тексты не переписываются: части склеиваются обратно теми же словами.

const END = '.!?…';
const AFTER_END = `${END}»"”`;
/** Ссылка на источник сразу за точкой («… сцену. [Хис, гл. 11]») остаётся со своим предложением. */
const TRAILING_REF = /^\s*[[(][^\])]*[\])][.!?…]*/;
/** Новое предложение — с заглавной буквы, кавычки или скобки; строчная после точки — сокращение («т. е.»). */
const STARTS_SENTENCE = /^\s+(?:\p{Lu}|[«"„“([])/u;

/** Делит текст на предложения. Точки внутри скобок («[Арнтц, 5.1.1]», «(гл. 12)») предложение не рвут. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  const cut = (end: number) => {
    const part = text.slice(start, end).trim();
    if (part) out.push(part);
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && END.includes(ch)) {
      let end = i + 1;
      while (end < text.length && AFTER_END.includes(text[end])) end++;
      end += TRAILING_REF.exec(text.slice(end))?.[0].length ?? 0;
      if (STARTS_SENTENCE.test(text.slice(end))) cut(end);
      i = end - 1;
    }
  }
  cut(text.length);
  return out;
}

/** Склеивает выбранные части в один текст; части без точки в конце (название задания) получают её. */
export function joinSentences(parts: readonly string[]): string {
  const kept = parts.map((p) => p.trim()).filter(Boolean);
  return kept
    .map((p, i) =>
      i < kept.length - 1 && !/[.!?…:;][»"”)\]]*$/.test(p) ? `${p}.` : p,
    )
    .join(' ');
}
