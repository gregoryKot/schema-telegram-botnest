// Оверлей, собранный одним JSX-элементом из нескольких источников, для гейта check-history-sheet.mjs:
// объект style (с его спредами и константой стиля того же файла) и классы className складываются.
// Источник, оверлейный сам по себе, уже находят inlineOverlays/classOverlays — здесь он не повторяется.
// Тест — history-sheet.spec.ts.
import { stripComments } from './gate-strip-comments.mjs';
import { isOverlayDecls, lineAt, matchBrace, skipString } from './history-sheet-detect.mjs';

const isQuote = (c) => c === "'" || c === '"' || c === '`';

/** Индекс `>`, закрывающей открывающий тег с `<` в start; -1 — не JSX (дженерик, сравнение). */
function tagEnd(src, start) {
  let depth = 0;
  for (let i = start + 1; i < src.length; i += 1) {
    const c = src[i];
    if (isQuote(c)) i = skipString(src, i);
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (depth === 0 && c === '>') return i;
    else if (depth === 0 && c === '<') return -1;
  }
  return -1;
}

/** Атрибуты style/className самого тега, не вложенных в его выражения элементов: [{ name, text }]. */
function ownAttrs(src, from, end) {
  const out = [];
  let depth = 0;
  for (let i = from; i < end; i += 1) {
    const c = src[i];
    const m = depth === 0 && /\s/.test(src[i - 1]) ? /^(style|className)\s*=\s*/.exec(src.slice(i, i + 32)) : null;
    if (m) {
      const at = i + m[0].length;
      const close = isQuote(src[at]) ? skipString(src, at) : src[at] === '{' ? matchBrace(src, at) : -1;
      if (close === -1) continue;
      out.push({ name: m[1], text: src.slice(at, close + 1) });
      i = close;
    } else if (isQuote(c)) i = skipString(src, i);
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
  }
  return out;
}

/** Текст объекта `const NAME = { … }` того же файла; null, если такой константы нет. */
function constObject(src, name) {
  const m = new RegExp(`\\b(?:const|let)\\s+${name.replace(/\$/g, '\\$')}\\b[^=\\n]*=\\s*\\(?\\s*\\{`).exec(src);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const close = matchBrace(src, open);
  return close === -1 ? null : src.slice(open, close + 1);
}

/** Источники стиля: литерал, его спреды `...NAME` и `style={NAME}` — константами того же файла. */
function styleSources(src, expr) {
  const names = [...expr.matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
  const bare = /^\{\s*([A-Za-z_$][\w$]*)\s*\}$/.exec(expr);
  if (bare) names.push(bare[1]);
  return [expr, ...names.map((n) => constObject(src, n)).filter(Boolean)];
}

/**
 * Оверлеи, которые дают только вместе style, его спреды и классы одного элемента
 * (`position: fixed` в style, `inset: 0` в классе или в спреде). decls — classDeclarations.
 */
export function elementOverlays(rawSrc, decls) {
  const src = stripComments(rawSrc, false);
  const found = [];
  for (const m of src.matchAll(/<([A-Za-z][\w.]*)/g)) {
    const end = tagEnd(src, m.index);
    if (end === -1) continue;
    const attrs = ownAttrs(src, m.index + m[0].length, end);
    const style = attrs.filter((a) => a.name === 'style').flatMap((a) => styleSources(src, a.text));
    const classes = attrs
      .filter((a) => a.name === 'className')
      .flatMap((a) => [...new Set(a.text.match(/[A-Za-z_][\w-]*/g) ?? [])].filter((t) => decls.has(t)));
    const sources = [...style, classes.map((cls) => decls.get(cls)).join(';')].filter(Boolean);
    if (sources.length < 2 || sources.some(isOverlayDecls) || !isOverlayDecls(sources.join(';'))) continue;
    const parts = classes.length ? `style + классы «${classes.join('» + «')}»` : 'style + спред константы';
    found.push({ line: lineAt(src, m.index), what: `<${m[1]}>: ${parts} (fixed + весь экран вместе)` });
  }
  return found;
}
