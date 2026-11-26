// Куда уходит отказ промиса в загрузчике экрана (правила check-dead-end-report-rules.mjs):
//   - `.then(…set…)`, отданный дальше (аргумент, присваивание, `return`), — пойман ли он
//     у получателя: `.catch` в его цепочке, `Promise.allSettled`, `await` под `try`;
//   - `async`-загрузчик с `await` вне `try…catch`, чей вызов никто не ловит.
import { matchParen, lineAt, skipString } from './gate-balance.mjs';
import { scopeAt, ownerOf } from './dead-end-report-blocks.mjs';

const KEYWORD_RE = /^(?:void|return|await|typeof|yield)$/;
const MAX_HOPS = 6;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Начало выражения, которому принадлежит позиция i, и символ-граница перед ним. */
export function statementStart(src, i) {
  let depth = 0;
  for (let j = i - 1; j >= 0; j -= 1) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') continue;
    if (')]}'.includes(c)) depth += 1;
    else if ('([{'.includes(c)) {
      if (depth === 0) return { at: j + 1, stop: c };
      depth -= 1;
    } else if (depth === 0 && (c === ';' || c === ',')) return { at: j + 1, stop: c };
    else if (depth === 0 && c === '>' && src[j - 1] === '=') return { at: j + 1, stop: '=>' };
  }
  return { at: 0, stop: ';' };
}

/** Запятая верхнего уровня в аргументах (`.then(ok, fail)` — отказ обработан). */
export function hasTopLevelComma(src, open, close) {
  let depth = 0;
  for (let j = open + 1; j < close; j += 1) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') { j = skipString(src, j); continue; }
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ',' && depth === 0) return true;
  }
  return false;
}

/** Конец цепочки после `)` на close; -1 — в цепочке есть `.catch(` или `.then(ok, fail)`. */
export function chainEnd(src, close) {
  let k = close + 1;
  for (;;) {
    const next = /^\s*\.(then|finally|catch)\(/.exec(src.slice(k, k + 200));
    if (!next) return k;
    if (next[1] === 'catch') return -1;
    const open = k + next[0].length - 1;
    const end = matchParen(src, open);
    if (end === -1) return k;
    if (next[1] === 'then' && hasTopLevelComma(src, open, end)) return -1;
    k = end + 1;
  }
}

export const inRanges = (ranges, i) => ranges.some(([a, b]) => i > a && i < b);

/** Незакрытая скобка, внутри которой стоит позиция i. */
function openerBefore(src, i) {
  let depth = 0;
  for (let j = i - 1; j >= 0; j -= 1) {
    const c = src[j];
    if (')]}'.includes(c)) depth += 1;
    else if ('([{'.includes(c)) {
      if (depth === 0) return j;
      depth -= 1;
    }
  }
  return -1;
}

/** Каждый вызов функции `name` пойман получателем; определение вызовом не считается. */
function callsCaught(src, ctx, name, hops) {
  const re = new RegExp(`(?<![\\w$.])${escapeRe(name)}\\(`, 'g');
  for (const m of src.matchAll(re)) {
    if (/\bfunction\s*\*?\s*$/.test(src.slice(0, m.index))) continue;
    const close = matchParen(src, m.index + m[0].length - 1);
    if (close === -1 || chainEnd(src, close) === -1) continue;
    if (unhandled(src, ctx, m.index, hops + 1)) return false;
  }
  return true;
}

/** Промис в переменной `name` пойман хоть где-то: `.catch`, `.then(ok, fail)`, получатель. */
function nameCaught(src, ctx, name, declAt, hops) {
  const re = new RegExp(`(?<![\\w$.])${escapeRe(name)}(?![\\w$])`, 'g');
  for (const m of src.matchAll(re)) {
    if (m.index <= declAt) continue;
    const after = m.index + m[0].length;
    if (chainEnd(src, after - 1) === -1) return true;
    if (/^\s*\.(?:then|finally)\(/.test(src.slice(after, after + 40))) continue;
    if (!unhandled(src, ctx, m.index, hops + 1)) return true;
  }
  return false;
}

function ownerCaught(src, ctx, own, hops) {
  if (own.owner === 'then') return true; // вернётся во внешнюю цепочку — её проверят саму
  return own.owner === 'named' && callsCaught(src, ctx, own.name, hops);
}

/** Отказ выражения-промиса с позиции pos никто не ловит. */
export function unhandled(src, ctx, pos, hops = 0) {
  if (hops > MAX_HOPS) return true;
  const { at, stop } = statementStart(src, pos);
  const head = src.slice(at, pos).trim();
  if (/^await\b|\bawait\s+[\w$.]*$/.test(head)) return false; // await — забота правила загрузчиков
  if ('([,'.includes(stop)) {
    const open = stop === ',' ? openerBefore(src, at - 1) : at - 1;
    if (open === -1 || src[open] === '{') return true;
    if (src[open] === '[') return unhandled(src, ctx, open, hops + 1);
    const close = matchParen(src, open);
    if (close !== -1 && chainEnd(src, close) === -1) return false;
    const callee = /[\w$.]+$/.exec(src.slice(0, open).trimEnd());
    if (!callee || KEYWORD_RE.test(callee[0])) return unhandled(src, ctx, open, hops + 1);
    if (/^Promise\.allSettled$/.test(callee[0])) return false;
    return unhandled(src, ctx, callee.index, hops + 1);
  }
  if (stop === '=>') {
    const before = src.slice(0, at - 2).trimEnd().replace(/(?:\([^()]*\)|[\w$]+)$/, '');
    return !ownerCaught(src, ctx, ownerOf(before), hops);
  }
  if (/^return\b/.test(head)) {
    const { fn } = scopeAt(ctx.blocks, pos);
    return !(fn && ownerCaught(src, ctx, fn, hops));
  }
  const target = /^(?:const|let|var)\s+([\w$]+)[^=]*=(?![=>])|^([\w$.]+)\s*=(?![=>])/.exec(head);
  if (target) return !nameCaught(src, ctx, target[1] ?? target[2], pos, hops);
  return true;
}

/** `async`-загрузчики экрана с `await` вне `try…catch`, чей вызов никто не ловит. */
export function unguardedLoaders(src, ctx, out) {
  for (const fn of ctx.blocks) {
    if (fn.kind !== 'fn' || !fn.isAsync) continue;
    const calledInEffect = fn.owner === 'named'
      && [...src.matchAll(new RegExp(`(?<![\\w$.])${escapeRe(fn.name)}\\(`, 'g'))].some((c) => inRanges(ctx.effects, c.index));
    if (!inRanges(ctx.effects, fn.open) && !calledInEffect) continue;
    const body = src.slice(fn.open, fn.close);
    const bare = [...body.matchAll(/\bawait\b/g)].map((a) => fn.open + a.index).find((i) => {
      const scope = scopeAt(ctx.blocks, i);
      return scope.fn === fn && !scope.guarded;
    });
    if (bare === undefined) continue;
    const setter = /\b(set[A-Z]\w*)\s*\(/.exec(src.slice(bare, fn.close)) ?? /\b(set[A-Z]\w*)\s*\(/.exec(body);
    if (!setter) continue;
    const iife = /^\}\s*\)\s*\(\s*\)/.exec(src.slice(fn.close, fn.close + 40));
    if (iife && chainEnd(src, fn.close + iife[0].length - 1) === -1) continue;
    if (fn.owner === 'named' && callsCaught(src, ctx, fn.name, 0)) continue;
    if (fn.owner === 'then') continue; // колбэк цепочки: отказ уходит в неё, её ловит правило .then
    out.push({ setter: setter[1], reports: false, kind: 'unguarded', line: lineAt(src, bare) });
  }
}
