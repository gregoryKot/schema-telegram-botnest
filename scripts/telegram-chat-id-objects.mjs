// Адрес полем объекта-переменной, для гейта check-telegram-chat-id.mjs
// (разбор — telegram-chat-id-flow.mjs). Отправщик ждёт адрес полем параметра
// (`push(s)`, где `sendTg(s.chatId)`), а вызывающий передаёт переменную `s`:
// поле берётся из её литерала (`const s = { chatId: userId }`), из присваивания
// `s.chatId = …`, из литерала, который возвращает функция-источник
// (`const s = toSendSettings(r)` → `return { chatId: resolveChatId(…) }`), а
// если `s` — параметр вызывающего, адрес идёт выше по нему (`s.chatId`).
// Объект из карты (`map.get(id)`) — telegram-chat-id-maps.mjs. Слепая зона:
// источник без объявления и без типа в src (ответ Prisma, карта без `Map<K, V>`).
import { matchBrace, matchParen, skipString } from './gate-balance.mjs';
import { fieldOf } from './telegram-chat-id-params.mjs';

const esc = (s) => s.replace(/\$/g, '\\$');
const CALL_RE = /^(?:await\s+)?(?:(this\.)|((?:this\.)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.)?([A-Za-z_$][\w$]*)\s*(?:<[^()]*>)?\(/;

/** Выражение с позиции i до `;`, `,` или перевода строки верхнего уровня. */
function exprAt(src, i) {
  let depth = 0;
  for (let j = i; j < src.length; j += 1) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') { j = skipString(src, j); continue; }
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) { if (depth === 0) return src.slice(i, j).trim(); depth -= 1; }
    else if (depth === 0 && ';,\n'.includes(c)) return src.slice(i, j).trim();
  }
  return src.slice(i).trim();
}

/** Ближайшее до at `const|let|var name = …`: { at, init }; нет — null. */
export function declBefore(src, name, at) {
  const re = new RegExp(String.raw`\b(?:const|let|var)\s+${esc(name)}\s*(?::[^=;]+)?=(?![=>])\s*`, 'g');
  let last = null;
  for (const m of src.matchAll(re)) if (m.index < at) last = m;
  return last && { at: last.index, init: exprAt(src, last.index + last[0].length) };
}

/** Вызов-источник целиком (`await f(x)`, `this.svc.make(x)`): { pre, recv, name, open }; иначе null. */
export function callOf(init) {
  const m = CALL_RE.exec(init);
  if (!m) return null;
  const open = m[0].length - 1;
  return matchParen(init, open) === init.length - 1
    ? { pre: m[1] ? 'this.' : m[2] ? '.' : '', recv: m[2], name: m[3], open: -1 }
    : null;
}

/** Литералы `{ … }`, которые возвращает fn (`return {`, тело-стрелка `({`), без вложенных функций. */
function returned(src, fn, fns) {
  const nested = (i) => fns.some((g) => g !== fn && g.start > fn.start && g.start <= i && i < g.end);
  const out = [];
  const arrow = /^\(\s*\{/.exec(src.slice(fn.start, fn.end));
  if (arrow) out.push(fn.start + arrow[0].length - 1);
  for (const m of src.slice(fn.start, fn.end).matchAll(/\breturn\s*\{/g)) {
    const at = fn.start + m.index + m[0].length - 1;
    if (!nested(at)) out.push(at);
  }
  return out.map((at) => ({ at, text: src.slice(at, matchBrace(src, at) + 1) }));
}

/**
 * Откуда поле field объекта-переменной name у вызова в at файла f:
 * [{ file, at, target, synthetic? }]. ctx: { fnsOf, homeOf, defsFor(f, call) }.
 */
export function objectField(f, name, field, at, ctx) {
  // Параметр вызывающего: разбор через `name.field` поднимет адрес к его вызывающим.
  const out = [{ file: f, at, target: `${name}.${field}`, synthetic: true }];
  const set = new RegExp(String.raw`(?<![\w$.])${esc(name)}\.${field}\s*=(?![=>])\s*`, 'g');
  for (const m of f.src.matchAll(set)) {
    if (m.index < at) out.push({ file: f, at: m.index, target: exprAt(f.src, m.index + m[0].length) });
  }
  const decl = declBefore(f.src, name, at);
  if (!decl) return out;
  const lit = fieldOf(decl.init, field);
  if (lit) return [...out, { file: f, at: decl.at, target: lit }];
  const call = callOf(decl.init);
  for (const def of call ? ctx.defsFor(f, call) : []) {
    const home = ctx.homeOf(def);
    for (const r of returned(home.src, def, ctx.fnsOf(home))) {
      const target = fieldOf(r.text, field);
      if (target) out.push({ file: home, at: r.at, target });
    }
  }
  return out;
}
