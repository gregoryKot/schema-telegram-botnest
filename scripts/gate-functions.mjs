// Разбор функций в исходнике TS для гейтов, которым нужен путь значения через
// параметр (check-telegram-chat-id: адрес отправки, пришедший из другого файла)
// или ответ «эта скобка — список параметров, а не вызов» (check-next-session-reads:
// деструктуризация в параметрах). Комментарии вызывающий стирает заранее
// (gate-strip-comments.mjs), строки и шаблоны скобками не считаются
// (gate-balance.mjs). Разбор синтаксический, без типов.
import { matchParen, matchBrace, skipString } from './gate-balance.mjs';

const ID = String.raw`[A-Za-z_$][\w$]*`;
// `if (…) {` и соседи — не функция; после этих слов `(` открывает безымянную.
const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'with']);
const NOT_NAME = new Set(['return', 'await', 'typeof', 'new', 'void', 'yield', 'in', 'of', 'case', 'else', 'do', 'delete', 'throw', 'async', 'function', 'constructor', 'super', 'import', 'extends']);
const FN_NAME_RE = new RegExp(String.raw`\bfunction\s*\*?\s*(${ID})\s*(?:<[^()]*>)?\s*$`);
const CALLEE_RE = new RegExp(String.raw`(${ID})\s*(?:<[^()]*>)?\s*$`);
const ASSIGNED_RE = new RegExp(String.raw`(${ID})\s*\??\s*[:=]\s*(?:async\s*)?(?:function\s*\*?\s*)?$`);
const PARAM_RE = new RegExp(String.raw`^(?:(?:public|private|protected|readonly|override)\s+)*(?:\.\.\.)?(${ID})`);
const SINGLE_ARROW_RE = new RegExp(String.raw`(?:(${ID})\s*[:=]\s*)?(?:async\s+)?(?<![\w$.])(${ID})\s*=>`, 'g');
const isQuote = (c) => c === "'" || c === '"' || c === '`';
const skipSpace = (src, i) => { while (/\s/.test(src[i] ?? '')) i += 1; return i; };

/** Части списка через запятую верхнего уровня; angles — `<…>` тоже скобки (типы параметров). */
export function splitTop(s, angles = false) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (isQuote(c)) { i = skipString(s, i); continue; }
    if (c === '=' && s[i + 1] === '>') { i += 1; continue; }
    if ('([{'.includes(c) || (angles && c === '<')) depth += 1;
    else if (')]}'.includes(c) || (angles && c === '>')) depth -= 1;
    else if (c === ',' && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
  }
  out.push(s.slice(start).trim());
  return out;
}

/** Аргументы вызова, чья `(` стоит на open. */
export function callArgs(src, open) {
  const close = matchParen(src, open);
  return close === -1 ? [] : splitTop(src.slice(open + 1, close));
}

/** Имя функции по тексту перед `(`: '' — безымянная, null — не функция (`if (`). */
function nameBefore(src, open) {
  const before = src.slice(Math.max(0, open - 160), open);
  const fn = FN_NAME_RE.exec(before);
  if (fn) return fn[1];
  const callee = CALLEE_RE.exec(before);
  if (callee && CONTROL.has(callee[1])) return null;
  if (callee && !NOT_NAME.has(callee[1])) return callee[1];
  return ASSIGNED_RE.exec(before)?.[1] ?? '';
}

/** Индекс `{` тела или `=>` после типа возврата, начатого на i; -1 — это не тип,
 *  а тернарник или ключ объекта. `{` там, где ждём начало типа, — литерал типа. */
function skipReturnType(src, i) {
  let depth = 0;
  let operand = true;
  for (; i < src.length; i += 1) {
    const c = src[i];
    if (/\s/.test(c)) continue;
    if (isQuote(c)) { i = skipString(src, i); operand = false; }
    else if (c === '=' && src[i + 1] === '>') { if (depth === 0 && !operand) return i; i += 1; operand = true; }
    else if ('<(['.includes(c)) { depth += 1; operand = true; }
    else if ('>)]'.includes(c)) { depth -= 1; operand = false; if (depth < 0) return -1; }
    else if (c === '{') {
      if (depth === 0 && !operand) return i;
      i = matchBrace(src, i);
      if (i === -1) return -1;
      operand = false;
    } else if ('|&,?:'.includes(c)) operand = true;
    else if (';}='.includes(c)) return -1;
    else operand = false;
  }
  return -1;
}

/** Начало тела функции после `)` её параметров: { at, block }; null — не функция. */
function bodyAfter(src, close) {
  let i = skipSpace(src, close + 1);
  if (src[i] === ':') i = skipReturnType(src, i + 1);
  if (i === -1) return null;
  if (src[i] === '{') return { at: i, block: true };
  if (src[i] !== '=' || src[i + 1] !== '>') return null;
  i = skipSpace(src, i + 2);
  return { at: i, block: src[i] === '{' };
}

/** Конец выражения-тела стрелки, начатого на i. */
function exprEnd(src, i) {
  let depth = 0;
  for (; i < src.length; i += 1) {
    const c = src[i];
    if (isQuote(c)) { i = skipString(src, i); continue; }
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) { if (depth === 0) return i; depth -= 1; }
    else if ((c === ',' || c === ';') && depth === 0) return i;
  }
  return i;
}

/** Тело [start, end); inert — тело-выражение без вызова (тип `(a: T) => R` в интерфейсе). */
function span(src, body) {
  const end = body.block ? matchBrace(src, body.at) : exprEnd(src, body.at);
  return { start: body.at, end, inert: !body.block && !src.slice(body.at, end).includes('(') };
}

/** Скобка open — список параметров функции, а не вызов или условие. */
export function isParamList(src, open) {
  if (nameBefore(src, open) === null) return false;
  const close = matchParen(src, open);
  return close !== -1 && bodyAfter(src, close) !== null;
}

/** Функции исходника: { name, head, params, start, end, inert }. head — `(`
 *  параметров (-1 у `x => …`), name '' — безымянная, параметр-деструктуризация — null. */
export function functionsOf(src) {
  const fns = [];
  for (let i = 0; i < src.length; i += 1) {
    if (isQuote(src[i])) { i = skipString(src, i); continue; }
    if (src[i] !== '(') continue;
    const name = nameBefore(src, i);
    const close = name === null ? -1 : matchParen(src, i);
    const body = close === -1 ? null : bodyAfter(src, close);
    if (!body) continue;
    const params = splitTop(src.slice(i + 1, close), true).map((p) => PARAM_RE.exec(p)?.[1] ?? null);
    fns.push({ name, head: i, params, ...span(src, body) });
  }
  for (const m of src.matchAll(SINGLE_ARROW_RE)) {
    // `): string =>` — тип возврата, а не параметр.
    if (NOT_NAME.has(m[2]) || (!m[1] && /:\s*$/.test(src.slice(Math.max(0, m.index - 8), m.index)))) continue;
    const at = skipSpace(src, m.index + m[0].length);
    fns.push({ name: m[1] ?? '', head: -1, params: [m[2]], ...span(src, { at, block: src[at] === '{' }) });
  }
  return fns;
}
