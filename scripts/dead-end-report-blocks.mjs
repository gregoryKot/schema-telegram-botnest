// Разбор блоков `{…}` для правил check-dead-end-report: где функция, где `try`,
// чья она (имя, колбэк `.then`, колбэк `useEffect`). Один проход вперёд со
// стеком; строки и шаблоны скобок не дают. Комментарии стёрты вызывающим.
import { skipString } from './gate-balance.mjs';

const CONTROL_RE = /\b(?:if|for|while|switch|catch|with)\s*$/;
const PLAIN_RE = /\b(?:else|finally|do|catch)\s*$/;
const RETURN_TYPE_RE = /\)\s*:\s*[\w<>[\]., |]+$/;

/** Чья функция: текст перед её параметрами (или перед `function`). */
export function ownerOf(before) {
  const text = before.replace(/\basync\s*$/, '').trimEnd();
  const wrapped = text.replace(/\buse(?:Callback|Memo)\(\s*$/, '').trimEnd();
  const named = /([\w$]+)\s*(?::[^=;{}]+)?=$/.exec(wrapped);
  if (named) return { owner: 'named', name: named[1] };
  if (/\.(?:then|finally)\($/.test(text)) return { owner: 'then' };
  if (/\buseEffect\($/.test(text)) return { owner: 'effect' };
  return { owner: 'anon' };
}

function classify(src, open, parenOpen) {
  const before = src.slice(0, open).trimEnd();
  if (/\btry$/.test(before)) return { kind: 'try' };
  if (PLAIN_RE.test(before)) return { kind: 'ctrl' };
  let head = null;
  if (before.endsWith('=>')) {
    const params = before.slice(0, -2).trimEnd();
    const start = params.endsWith(')') ? parenOpen.get(params.length - 1) : params.search(/[\w$]+$/);
    if (start == null || start < 0) return { kind: 'other' };
    head = src.slice(0, start);
  } else {
    const sig = RETURN_TYPE_RE.test(before) ? before.replace(/\s*:\s*[\w<>[\]., |]+$/, '') : before;
    if (!sig.endsWith(')')) return { kind: 'other' };
    const start = parenOpen.get(sig.length - 1);
    if (start == null) return { kind: 'other' };
    head = src.slice(0, start);
    if (CONTROL_RE.test(head)) return { kind: 'ctrl' };
    const decl = /\bfunction\s*\*?\s*([\w$]*)\s*$/.exec(head);
    if (decl) {
      const pre = head.slice(0, decl.index);
      const isAsync = /\basync\s*$/.test(pre);
      return { kind: 'fn', isAsync, ...(decl[1] ? { owner: 'named', name: decl[1] } : ownerOf(pre)) };
    }
    head = head.replace(/[\w$]+\s*$/, '');
  }
  return { kind: 'fn', isAsync: /\basync\s*$/.test(head.trimEnd()), ...ownerOf(head.trimEnd()) };
}

/** Блоки файла: [{ open, close, kind: 'fn'|'try'|'ctrl'|'other', isAsync?, owner?, name?, caught? }]. */
export function parseBlocks(src) {
  const blocks = [];
  const braces = [];
  const parens = [];
  const parenOpen = new Map();
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i); continue; }
    if (c === '(') parens.push(i);
    else if (c === ')') { if (parens.length) parenOpen.set(i, parens.pop()); }
    else if (c === '{') braces.push({ open: i, close: -1, ...classify(src, i, parenOpen) });
    else if (c === '}' && braces.length) {
      const b = braces.pop();
      b.close = i;
      if (b.kind === 'try') b.caught = /^\s*catch\b/.test(src.slice(i + 1, i + 40));
      blocks.push(b);
    }
  }
  return blocks.sort((a, b) => a.open - b.open);
}

/** Блоки вокруг позиции i, от ближнего к дальнему. */
export function enclosing(blocks, i) {
  return blocks.filter((b) => b.open < i && i < b.close).reverse();
}

/** Ближайшая функция вокруг i и признак «i под try с catch внутри неё». */
export function scopeAt(blocks, i) {
  let guarded = false;
  for (const b of enclosing(blocks, i)) {
    if (b.kind === 'try' && b.caught) guarded = true;
    if (b.kind === 'fn') return { fn: b, guarded };
  }
  return { fn: null, guarded };
}
