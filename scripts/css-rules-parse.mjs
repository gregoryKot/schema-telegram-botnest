// Мини-разборщик CSS для гейтов, которым нужны правила целиком: селектор,
// объявления, вложенность в at-правила (@media, @keyframes) и номер строки.
// Регэксп по строке тут не годится: «спрятано в одном правиле, раскрыто в
// другом» — свойство пары правил, а не строки.
//
// Вход — текст БЕЗ комментариев (gate-strip-comments.mjs сохраняет переводы
// строк, номера не съезжают). Кавычки и скобки уважаются: `;` и `{` внутри
// `url("data:image/svg+xml;…")` правилом не считаются.

/**
 * @returns {{ selector: string, decls: Record<string,string>, ctx: string[], line: number }[]}
 *   ctx — предварительные части всех охватывающих at-правил, снаружи внутрь.
 *   Правила внутри @keyframes в результат не попадают: это анимация, а не
 *   состояние элемента.
 */
export function parseCssRules(text) {
  const rules = [];
  const stack = [];
  let buf = '';
  let bufLine = 1;
  let line = 1;
  let quote = null;
  let paren = 0;

  const pushDecl = () => {
    const top = stack[stack.length - 1];
    const m = buf.match(/^\s*([\w-]+)\s*:([\s\S]*)$/);
    if (top && !top.at && m) {
      top.decls[m[1].toLowerCase()] = m[2].replace(/!important/i, '').trim();
    }
    buf = '';
  };

  for (const c of text) {
    if (c === '\n') line++;
    if (quote) {
      buf += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      buf += c;
      continue;
    }
    if (c === '(') paren++;
    if (c === ')') paren = Math.max(0, paren - 1);
    if (paren > 0 || (c !== '{' && c !== '}' && c !== ';')) {
      if (!buf.trim()) bufLine = line;
      buf += c;
      continue;
    }
    if (c === ';') {
      pushDecl();
    } else if (c === '{') {
      const prelude = buf.trim().replace(/\s+/g, ' ');
      stack.push({
        prelude,
        at: prelude.startsWith('@'),
        decls: {},
        line: bufLine,
      });
      buf = '';
    } else {
      pushDecl();
      const done = stack.pop();
      if (done && !done.at) {
        const ctx = stack.filter((f) => f.at).map((f) => f.prelude);
        if (!ctx.some((p) => /^@(-\w+-)?keyframes/.test(p))) {
          rules.push({
            selector: done.prelude,
            decls: done.decls,
            ctx,
            line: done.line,
          });
        }
      }
    }
  }
  return rules;
}

/** Делит список селекторов по запятым верхнего уровня (`:is(a, b)` цел). */
export function splitSelectorList(selector) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const c of selector) {
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
