// Места записи localStorage в файле — модуль правил гейта
// check-local-cache-writers.mjs (движок + правила, правило №10). Запись — прямой
// `localStorage.setItem/removeItem`, вызов функции-движка или те же методы у
// объекта-хранилища из "storageVars" движка: модуль, получающий Storage
// параметром (PrefStorage у uiPrefsSync.ts), иначе прятал бы свои ключи от гейта.
import { join } from 'path';
import { importMap, resolveKeyExpr } from './local-cache-resolve.mjs';
import { matchBracket, splitTopLevel } from './local-cache-source.mjs';

const DIRECT = String.raw`(?:window\.)?localStorage`;
const IDENT = /^[A-Za-z_$][\w$]*$/;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function lineAt(src, index) {
  return src.slice(0, index).split('\n').length;
}

/** Индексы `(` у вызовов `<who>.setItem(` / `<who>.removeItem(`; who — фрагмент регэкспа. */
function storageCalls(src, who) {
  const re = new RegExp(String.raw`(?:^|[^\w$.])${who}\s*\.\s*(?:setItem|removeItem)\s*\(`, 'g');
  return [...src.matchAll(re)].map((m) => m.index + m[0].length - 1);
}

/** Имена переменных-хранилищ движка, годные для поиска записей. */
function validVars(vars) {
  return Array.isArray(vars) ? vars.filter((v) => IDENT.test(String(v))) : [];
}

/** Претензии к storageVars движка: не список имён или имя без единой записи в файле. */
export function storageVarProblems(rel, src, vars = []) {
  if (!Array.isArray(vars) || validVars(vars).length !== vars.length) {
    return [`движок ${rel}: storageVars — список имён переменных-хранилищ`];
  }
  return vars
    .filter((name) => storageCalls(src, escapeRe(name)).length === 0)
    .map((name) => `движок ${rel}: storageVars «${name}» — в файле нет ${name}.setItem/removeItem (протухшая запись)`);
}

/** Аргумент-ключ вызова, чья `(` стоит в parenIndex: позиционный (where —
 * число, по умолчанию 0) или поле объекта-аргумента (where — имя поля). */
function keyArgument(src, parenIndex, where) {
  const close = matchBracket(src, parenIndex);
  if (close === -1) return null;
  const args = splitTopLevel(src.slice(parenIndex + 1, close), ',');
  if (!where || /^\d+$/.test(where)) return args[Number(where ?? 0)] ?? null;
  const prop = where;
  const obj = args.find((a) => a.startsWith('{'));
  if (!obj) return null;
  const end = matchBracket(obj, 0);
  for (const entry of splitTopLevel(obj.slice(1, end), ',')) {
    const colon = entry.search(/:(?!:)/);
    const name = (colon === -1 ? entry : entry.slice(0, colon)).trim();
    if (name === prop) return colon === -1 ? name : entry.slice(colon + 1).trim();
  }
  return null;
}

/** Все места записи в файле: localStorage, объекты-хранилища storageVars, вызовы движков. */
export function collectWrites(root, rel, ctx, engineFns, storageVars = []) {
  const abs = join(root, rel);
  const src = ctx.load(abs);
  const sites = [DIRECT, ...validVars(storageVars).map(escapeRe)]
    .flatMap((who) => storageCalls(src, who))
    .map((paren) => ({ paren, prop: null }));
  const imports = importMap(abs, src);
  let m;
  for (const { file, fn, prop } of engineFns) {
    const local = file === abs ? fn : [...imports].find(([, v]) => v.file === file && v.name === fn)?.[0];
    if (!local) continue;
    const call = new RegExp(`(^|[^\\w$.])${local}\\s*(?:<[^(]*>)?\\s*\\(`, 'g');
    while ((m = call.exec(src))) {
      const before = src.slice(Math.max(0, m.index - 12), m.index + m[1].length);
      if (/function\s*$/.test(before)) continue;
      sites.push({ paren: m.index + m[0].length - 1, prop });
    }
  }
  return sites.map(({ paren, prop }) => {
    const line = lineAt(src, paren);
    const arg = keyArgument(src, paren, prop);
    if (arg === null) return { line, error: 'не найден аргумент-ключ' };
    const res = resolveKeyExpr(arg, abs, ctx);
    return res.error ? { line, error: `${res.error} (${arg.slice(0, 50)})` } : { line, keys: res.keys };
  });
}
