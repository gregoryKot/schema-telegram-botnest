// Что лежит в карте, для гейта check-telegram-chat-id.mjs: объект
// `const s = byUser.get(id)` приходит из `Map<K, V>`, а объекты типа V строят
// функции с типом возврата V (`toSendSettings(…): SendSettings`) — их литералы
// и есть источник поля-адреса (разбор литералов — telegram-chat-id-objects.mjs).
// V берётся из аннотации карты, `new Map<K, V>(` или типа возврата функции,
// из которой карта получена. Слепая зона: карта без типа в src.
import { matchParen } from './gate-balance.mjs';
import { splitTop } from './gate-functions.mjs';
import { callOf, declBefore } from './telegram-chat-id-objects.mjs';
import { resolveDefs } from './telegram-chat-id-resolve.mjs';

const esc = (s) => s.replace(/\$/g, '\\$');

/** Тип возврата функции текстом (между `)` параметров и телом); у `x => …` — ''. */
export function returnType(src, fn) {
  const close = fn.head < 0 ? -1 : matchParen(src, fn.head);
  return close === -1 ? '' : src.slice(close + 1, fn.start).replace(/=>\s*$/, '').replace(/^\s*:/, '').trim();
}

/** V из первого `Map<K, V>` в тексте типа; сложный V (`A | B`, `X[]`) — null. */
export function mapValue(text) {
  const m = /\b(?:Readonly)?Map<([\s\S]*)$/.exec(text ?? '');
  if (!m) return null;
  let depth = 1;
  let end = 0;
  for (; end < m[1].length && depth > 0; end += 1) {
    if (m[1][end] === '<') depth += 1;
    else if (m[1][end] === '>') depth -= 1;
  }
  const value = splitTop(m[1].slice(0, end - 1), true)[1];
  return /^[A-Z][\w$]*$/.test(value ?? '') ? value : null;
}

/** V карты name в файле f: аннотация, `new Map<K, V>(` или тип возврата функции-источника. */
function mapValueOf(files, f, fnsOf, name) {
  const n = esc(name.replace(/^this\./, ''));
  const noted = new RegExp(String.raw`(?<![\w$.])${n}\s*\??\s*(?::|=\s*new)\s*((?:Readonly)?Map<[^;\n]*)`).exec(f.src);
  if (noted) return mapValue(noted[1]);
  const decl = declBefore(f.src, name, f.src.length);
  const call = decl && callOf(decl.init);
  for (const def of (call && resolveDefs(files, f, fnsOf, call)) || []) {
    const home = files.find((x) => fnsOf(x).includes(def));
    const value = home && mapValue(returnType(home.src, def));
    if (value) return value;
  }
  return null;
}

/**
 * Функции-источники объекта из вызова `карта.get(…)`: все функции src с типом
 * возврата V (или `Promise<V>`). null — это не карта с известным V.
 */
export function mapSources(files, f, fnsOf, call) {
  if (call.pre !== '.' || call.name !== 'get' || !/^(?:this\.)?[A-Za-z_$][\w$]*$/.test(call.recv ?? '')) return null;
  const value = mapValueOf(files, f, fnsOf, call.recv);
  if (!value) return null;
  const re = new RegExp(String.raw`^(?:Promise<\s*)?${esc(value)}(?![\w$<[.])`);
  return files.flatMap((x) => fnsOf(x).filter((fn) => !fn.inert && re.test(returnType(x.src, fn))));
}
