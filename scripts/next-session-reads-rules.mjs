// Разбор для гейта check-next-session-reads.mjs (движок — там же: обход,
// исключения, отчёт). Чтение `nextSession` мимо upcomingSession — это
// `.nextSession`/`?.nextSession` не первым аргументом `upcomingSession(…)` и
// деструктуризация: в объявлении (`const { nextSession } = rel`, `for (const { nextSession } of …)`)
// и в параметрах функции (`({ nextSession }) =>`, `function f({ nextSession: ns }: P) {`,
// вложенная `({ rel: { nextSession } }) =>`). Запись (`x.nextSession = …`),
// ключ объекта в вызове (`save({ nextSession: … })`) и типы
// (`(r: { nextSession: string }) =>`) — не чтения.
import { stripComments } from './gate-strip-comments.mjs';
import { lineAt, skipString } from './gate-balance.mjs';
import { isParamList } from './gate-functions.mjs';

const KEY = 'nextSession';
const DECL_RE = /\b(?:const|let|var)\s*\{[^{}]*\bnextSession\b[^{}]*\}\s*(?:(?::[^=]+)?=(?!=)|\bof\b)/g;
const isQuote = (c) => c === "'" || c === '"' || c === '`';
const prevChar = (src, i) => { let j = i - 1; while (j >= 0 && /\s/.test(src[j])) j -= 1; return src[j]; };
const nextChar = (src, i) => { let j = i; while (j < src.length && /\s/.test(src[j])) j += 1; return src[j]; };

/** Ключ шаблона `{ nextSession }` на позиции i: перед ним `{` или `,`, после — `,` `}` `:` `=`. */
function isPatternKey(src, i) {
  if (/[\w$.]/.test(src[i - 1] ?? '') || /[\w$]/.test(src[i + KEY.length] ?? '')) return false;
  return /[{,]/.test(prevChar(src, i) ?? '') && /[,}:=]/.test(nextChar(src, i + KEY.length) ?? '');
}

/** `{` стоит внутри `<…>` от open: литерал типа в дженерике (`Record<string, { … }>`). */
function inGeneric(src, open, brace) {
  const s = src.slice(open, brace).replace(/=>/g, '');
  return (s.match(/</g) ?? []).length > (s.match(/>/g) ?? []).length;
}

/** Скобки на верху стека — шаблон деструктуризации в списке параметров функции. */
function inParamPattern(src, stack) {
  for (let j = stack.length - 1; j > 0 && src[stack[j]] === '{'; j -= 1) {
    const prev = prevChar(src, stack[j]);
    const outer = stack[j - 1];
    if (src[outer] === '(') {
      return (prev === '(' || prev === ',') && !inGeneric(src, outer, stack[j]) && isParamList(src, outer);
    }
    if (src[outer] !== '{' || prev !== ':') return false;
  }
  return false;
}

/** Строки с деструктуризацией nextSession в параметрах функций. */
function paramReads(src) {
  const lines = [];
  const stack = [];
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (isQuote(c)) { i = skipString(src, i); continue; }
    if ('([{'.includes(c)) stack.push(i);
    else if (')]}'.includes(c)) stack.pop();
    else if (c === 'n' && src.startsWith(KEY, i) && isPatternKey(src, i) && inParamPattern(src, stack)) {
      lines.push(lineAt(src, i));
    }
  }
  return lines;
}

/** Прямые чтения nextSession мимо upcomingSession: номера строк. */
export function directReads(rawSrc) {
  const src = stripComments(rawSrc);
  const lines = paramReads(src);
  for (const m of src.matchAll(/\??\.nextSession\b/g)) {
    const before = src.slice(0, m.index);
    const after = src.slice(m.index + m[0].length);
    if (/upcomingSession\s*\(\s*[\w$?.[\]]*$/.test(before)) continue;
    if (/^\s*=(?!=)/.test(after)) continue;
    lines.push(lineAt(src, m.index));
  }
  for (const m of src.matchAll(DECL_RE)) lines.push(lineAt(src, m.index));
  return [...new Set(lines)].sort((a, b) => a - b);
}
