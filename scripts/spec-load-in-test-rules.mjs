// Правила гейта check-spec-load-in-test.mjs: где в спеке тест и что в нём — загрузка модуля.
import { matchParen, lineAt } from './gate-balance.mjs';
import { functionsOf } from './gate-functions.mjs';

// Загрузка своего модуля: относительный require/import(), загрузчик под ключами, изоляция реестра jest.
const LOAD_RE = /\brequire\s*\(\s*['"`]\.|\bimport\s*\(\s*['"`]\.|\bloadWithKeys\s*\(|\bjest\s*\.\s*isolateModules(?:Async)?\s*\(/g;
const TEST_RE = /(?<![\w$.])(?:it|test)(?:\s*\.\s*[\w$]+)*\s*\(/g;
const SUBJECT_RE = /(?<![\w$.])loadAsSubject\s*\(\s*(['"`])([^'"`\n]*)\1\s*,/g;
const esc = (s) => s.replace(/\$/g, '\\$');

/** Скобки `loadAsSubject('причина', …)`: загрузка — предмет теста. Пустая причина исключения не даёт. */
export function subjectRanges(src) {
  const out = [];
  for (const m of src.matchAll(SUBJECT_RE)) {
    if (!m[2].trim()) continue;
    const open = m.index + m[0].indexOf('(');
    const close = matchParen(src, open);
    if (close !== -1) out.push([open, close]);
  }
  return out;
}

/** Диапазоны вызовов `it(…)`/`test(…)`; у `it.each(таблица)(имя, тело)` — вторая пара скобок. */
export function testRanges(src) {
  const out = [];
  for (const m of src.matchAll(TEST_RE)) {
    let open = m.index + m[0].length - 1;
    let close = matchParen(src, open);
    const next = close === -1 ? null : /^\s*\(/.exec(src.slice(close + 1, close + 20));
    if (next) { open = close + next[0].length; close = matchParen(src, open); }
    if (close !== -1) out.push([open, close]);
  }
  return out;
}

/** Загрузки модулей внутри тестов: [{ line, what }]. src — без комментариев. */
export function findLoadsInTests(src) {
  const tests = testRanges(src);
  const inTest = (i) => tests.some(([a, b]) => i > a && i < b);
  const loads = [...src.matchAll(LOAD_RE)].map((m) => ({ at: m.index, what: m[0].replace(/\s+/g, '').replace(/\($|\(['"`]\.$/, '') }));
  // Функции спека вне тестов, которые грузят модуль сами или через другую такую же.
  const helpers = functionsOf(src).filter((fn) => fn.name && !inTest(fn.start));
  const loaders = new Set(helpers.filter((fn) => loads.some((l) => l.at >= fn.start && l.at < fn.end)).map((fn) => fn.name));
  const callsOf = (name) => [...src.matchAll(new RegExp(String.raw`(?<![\w$.])${esc(name)}\s*(?:<[^()]*>)?\s*\(`, 'g'))].map((m) => m.index);
  for (let grew = true; grew; ) {
    grew = false;
    for (const fn of helpers) {
      if (loaders.has(fn.name)) continue;
      if ([...loaders].some((name) => callsOf(name).some((at) => at >= fn.start && at < fn.end))) { loaders.add(fn.name); grew = true; }
    }
  }
  // Исключение даёт только обёртка в самом тесте: загрузчик с обёрткой внутри остаётся загрузчиком.
  const subjects = subjectRanges(src).filter(([a]) => inTest(a));
  const counted = (i) => inTest(i) && !subjects.some(([a, b]) => i > a && i < b);
  const found = loads.filter((l) => counted(l.at)).map((l) => ({ at: l.at, what: `загрузка ${l.what}` }));
  for (const name of loaders) {
    for (const at of callsOf(name)) if (counted(at)) found.push({ at, what: `вызов загрузчика ${name}()` });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => ({ line: lineAt(src, f.at), what: f.what }));
}
