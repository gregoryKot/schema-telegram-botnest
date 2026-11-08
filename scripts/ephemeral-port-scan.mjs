// Разбор исходника для scripts/check-ephemeral-port.mjs: где `.listen(0…)` и
// `.close(` стоят в одной функции. Без зависимостей (джоба checks идёт без
// npm ci): комментарии стирает gate-strip-comments.mjs, содержимое строк и
// шаблонов забивается пробелами, функции ищутся по скобкам.
//
// «Функция» — тело в фигурных скобках (`=> {`, `function f() {`, метод
// `f(): T {`; не if/for/while/catch) или тело стрелки без скобок
// (`(r) => server.listen(0, r)` — до первой незакрытой скобки или запятой).
// Исполнитель `new Promise((r) => …)` своей функцией не считается: это обёртка
// внутри той же функции (`await new Promise((r) => s.listen(0, r))`, следом
// `await new Promise((r) => s.close(r))` — та самая копия reservePort).
// `.close(` считается, если его ближайшая функция — та же, что у listen, или
// он внутри аргументов самого listen (колбэк, закрывающий сервер сразу после
// выдачи номера). Закрытие в другой функции — afterAll, `stop()`, замыкание
// `close: () => …`, которое фабрика отдаёт наружу, — законно.
import { stripComments } from './gate-strip-comments.mjs';

const LISTEN_ZERO = /\.listen\(\s*(?:0\s*[,)]|\{\s*port\s*:\s*0\b)/g;
const CLOSE = /\.close\(/g;
const CONTROL = /\b(?:if|for|while|switch|catch|with)\s*$/;
const OPEN = '([{';
const CLOSE_BR = ')]}';

/** Код без комментариев; содержимое строк и шаблонов — пробелы, переводы строк целы. */
export function maskCode(source) {
  const text = stripComments(source);
  let out = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!quote) {
      if (c === "'" || c === '"' || c === '`') quote = c;
      out += c;
    } else if (c === '\\') {
      out += text[i + 1] === '\n' ? ' \n' : '  ';
      i++;
    } else if (c === quote) {
      quote = null;
      out += c;
    } else {
      out += c === '\n' ? '\n' : ' ';
    }
  }
  return out;
}

/** Позиция скобки, закрывающей открытую в `from` (или конец текста). */
function matching(code, from) {
  let depth = 0;
  for (let i = from; i < code.length; i++) {
    if (OPEN.includes(code[i])) depth++;
    else if (CLOSE_BR.includes(code[i]) && --depth === 0) return i;
  }
  return code.length;
}

/** `{` открывает тело функции, а не блок if/for/catch, объект или класс. */
function isFunctionBody(code, open) {
  let before = code.slice(0, open).trimEnd();
  if (before.endsWith('=>')) return true;
  // Тип возврата: `f(): Promise<void> {` → `f()`.
  before = before.replace(/\)\s*:[^;{}()=]*$/, ')');
  if (!before.endsWith(')')) return false;
  let depth = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === ')') depth++;
    else if (before[i] === '(' && --depth === 0) {
      return !CONTROL.test(before.slice(0, i));
    }
  }
  return false;
}

/** Тело стрелки без скобок: от `=>` до незакрытой скобки, запятой или `;`. */
function arrowBodyEnd(code, from) {
  let depth = 0;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if (OPEN.includes(c)) depth++;
    else if (CLOSE_BR.includes(c) && depth-- === 0) return i;
    else if ((c === ',' || c === ';') && depth === 0) return i;
  }
  return code.length;
}

/** Стрелка, чей `=>` стоит в `arrow`, — исполнитель `new Promise(…)`. */
function isPromiseExecutor(code, arrow) {
  const params = code.slice(0, arrow).trimEnd();
  let start = params.length;
  if (params.endsWith(')')) {
    for (let depth = 0; start-- > 0; ) {
      if (params[start] === ')') depth++;
      else if (params[start] === '(' && --depth === 0) break;
    }
  } else {
    while (start > 0 && /[\w$]/.test(params[start - 1])) start--;
  }
  return /new\s+Promise\s*(?:<[^()]*>)?\s*\(\s*$/.test(params.slice(0, start));
}

/** Диапазоны функций [начало, конец] в замаскированном коде. */
function functionRanges(code) {
  const out = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '{' && isFunctionBody(code, i)) {
      const arrow = code.slice(0, i).trimEnd();
      const own = !arrow.endsWith('=>') || !isPromiseExecutor(code, arrow.length - 2);
      if (own) out.push([i, matching(code, i)]);
    } else if (code.startsWith('=>', i) && !isPromiseExecutor(code, i)) {
      const body = code.slice(i + 2).search(/\S/) + i + 2;
      if (code[body] !== '{') out.push([i, arrowBodyEnd(code, body)]);
    }
  }
  return out;
}

const innermost = (ranges, at) =>
  ranges
    .filter(([s, e]) => s < at && at < e)
    .reduce((best, r) => (!best || r[0] > best[0] ? r : best), null);

/** Строки (1-based), где listen(0) и close( в одной функции. */
export function findReleasedPorts(source) {
  const code = maskCode(source);
  const fns = functionRanges(code);
  const lines = [];
  for (const m of code.matchAll(LISTEN_ZERO)) {
    const own = innermost(fns, m.index);
    const argsOpen = m.index + m[0].indexOf('(');
    const argsClose = matching(code, argsOpen);
    const [from, to] = own ?? [0, code.length];
    const hit = [...code.slice(from, to).matchAll(CLOSE)].some(({ index }) => {
      const at = from + index;
      return (
        (argsOpen < at && at < argsClose) || innermost(fns, at) === own
      );
    });
    if (hit) lines.push(code.slice(0, m.index).split('\n').length);
  }
  return lines;
}
