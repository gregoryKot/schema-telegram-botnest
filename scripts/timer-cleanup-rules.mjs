// Разбор таймеров для check-timer-cleanup.mjs, по каждому `setTimeout` отдельно:
// колбэк меняет состояние — значит, id таймера лежит в переменной или ref, и
// `clearTimeout` этого id стоит в очистке. Комментарии и текст строк стёрты до разбора.
// Граница: смену состояния через вызов функции внутри колбэка (`() => void tick()`)
// гейт не видит — только прямой вызов и колбэк, переданный ссылкой.
import { stripComments } from './gate-strip-comments.mjs';
import { blankStrings } from './gate-blank-strings.mjs';
import { matchParen, lineAt } from './gate-balance.mjs';
import { functionsOf, callArgs } from './gate-functions.mjs';

const ID = String.raw`[A-Za-z_$][\w$]*`;
// Смена состояния: сеттер `setX(` (не метод `storage.setItem(` и не `setTimeout(`),
// колбэк-проп `onX(` / `props.onX?.(` / `onXRef.current(`, `dispatch(`.
const CHANGER = String.raw`(?:\bprops\.)?(?:on[A-Z][\w$]*(?:\.current)?|set(?!Timeout\b|Interval\b|Immediate\b)[A-Z][\w$]*|dispatch)`;
const STATE_CALL = new RegExp(String.raw`(?<![\w$.])${CHANGER}\s*(?:\?\.\s*)?\(`);
const STATE_REF = new RegExp(String.raw`^${CHANGER}$`);
const BARE_ID = new RegExp(String.raw`^${ID}$`);
// Куда кладут id: `t =`, `ref.current =`, `timers.current[id] =`, `const t: T =`,
// `timers.push(`, `const timers = DELAYS.map((ms) =>`.
const HOLDERS = [
  new RegExp(String.raw`(${ID})(?:\.[\w$]+|\[[^\]]*\])*(?:\s*:[^=;()]+)?\s*=\s*$`),
  new RegExp(String.raw`(${ID})(?:\.[\w$]+)*\.push\(\s*$`),
  new RegExp(String.raw`(${ID})\s*=\s*[^;=]*\.map\(\s*(?:\([^()]*\)|${ID})\s*=>\s*$`),
];
// Очистка — функция после `return` или `=>` (`useEffect(() => () => …)`) и
// именованная, которую так возвращают (`useEffect(() => stop, [stop])`) или зовут из первой.
const RETURNED = /(?:\breturn|=>)\s*(?:async\s+)?(?:function\b\s*)?$/;
const RETURNED_NAME = new RegExp(String.raw`(?:=>|\breturn)\s*(${ID})\s*[,;)}]`, 'g');
const CALLBACK_NAME = new RegExp(String.raw`\b(${ID})\s*=\s*useCallback\(\s*$`);
const BARE_CALL = new RegExp(String.raw`(?<![\w$.])(${ID})\s*\(`, 'g');
const ALIAS = new RegExp(String.raw`\b(?:const|let|var)\s+(${ID})\s*=\s*(${ID})(?:\.current)?\s*;`, 'g');

/** Код без комментариев и текста строк; позиции и переводы строк на месте. */
const codeOf = (raw) => blankStrings(stripComments(raw));
const before = (code, at, n) => (at < 0 ? '' : code.slice(Math.max(0, at - n), at));
const nameOf = (code, fn) => fn.name || CALLBACK_NAME.exec(before(code, fn.head, 80))?.[1] || '';

/** Что меняет колбэк: `setX`, `onDone`, `props.onDone`, `dispatch`, имя своей функции; иначе null. */
function changeOf(callback, code, fns) {
  const arg = callback.trim();
  if (STATE_REF.test(arg)) return arg;
  const call = STATE_CALL.exec(arg);
  if (call) return call[0].replace(/\s*(?:\?\.\s*)?\($/, '');
  // Колбэк — своя функция по имени: `const hide = () => setShown(false); setTimeout(hide, …)`.
  const own = BARE_ID.test(arg) && fns.some((fn) => nameOf(code, fn) === arg && STATE_CALL.test(code.slice(fn.start, fn.end)));
  return own ? arg : null;
}

function holderOf(code, at) {
  const head = before(code, at, 200).replace(/\b(?:window|globalThis)\.$/, '');
  for (const re of HOLDERS) {
    const m = re.exec(head);
    if (m) return m[1];
  }
  return null;
}

function cleanupSpans(code, fns) {
  const returned = fns.filter((fn) => RETURNED.test(before(code, fn.head, 40)));
  const names = new Set([...code.matchAll(RETURNED_NAME)].map((m) => m[1]));
  for (const fn of returned) for (const m of code.slice(fn.start, fn.end).matchAll(BARE_CALL)) names.add(m[1]);
  return [...returned, ...fns.filter((fn) => names.has(nameOf(code, fn)))];
}

/** Имена у каждого `clearTimeout` в очистке: вызов — вместе с условием и заголовком
 *  цикла перед ним, ссылка `timers.forEach(clearTimeout)` — с выражением; плюс псевдонимы. */
function clearedInCleanup(code, fns) {
  const spans = cleanupSpans(code, fns);
  const names = new Set();
  for (const m of code.matchAll(/\bclearTimeout\b/g)) {
    if (!spans.some((s) => m.index >= s.start && m.index < s.end)) continue;
    const from = Math.max(...[';', '{', '}'].map((c) => code.lastIndexOf(c, m.index))) + 1;
    const after = m.index + 'clearTimeout'.length;
    const call = /^\s*\(/.test(code.slice(after)) ? matchParen(code, code.indexOf('(', after)) : -1;
    for (const id of code.slice(from, call === -1 ? after : call).matchAll(new RegExp(ID, 'g'))) names.add(id[0]);
  }
  for (const [, alias, source] of code.matchAll(ALIAS)) {
    if (names.has(alias)) names.add(source);
    else if (names.has(source)) names.add(alias);
  }
  return names;
}

/** Таймеры, меняющие состояние без своей очистки: [{ line, change }]. */
export function uncleanedTimers(raw) {
  const code = codeOf(raw);
  const fns = functionsOf(code);
  const found = [];
  let cleared = null;
  for (const m of code.matchAll(/\bsetTimeout\s*\(/g)) {
    const change = changeOf(callArgs(code, m.index + m[0].length - 1)[0] ?? '', code, fns);
    if (!change) continue;
    cleared ??= clearedInCleanup(code, fns);
    const holder = holderOf(code, m.index);
    if (!holder || !cleared.has(holder)) found.push({ line: lineAt(code, m.index), change });
  }
  return found;
}
