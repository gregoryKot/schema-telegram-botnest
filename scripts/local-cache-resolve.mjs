// Разрешение ключа localStorage из выражения в исходнике — модуль правил
// гейта check-local-cache-writers.mjs (движок + правила, правило №10).
//
// Задача: по тексту первого аргумента `localStorage.setItem(<expr>, …)`
// (или вызова функции-движка) узнать, какой ключ пишется. Поддержано то, что
// реально встречается в webapp/ и shared/: строковый литерал, шаблон с
// литеральным префиксом (`modemap_vp_${id}` → `modemap_vp_*`), сложение
// 'celebrated_' + day, константа в том же файле, импортированная константа
// (через `export const`, `export { X } from`, `export * from`), поле объекта
// (`DRAFT_KEYS[type]` → все значения, `EXERCISE_DRAFT_KEYS.letter` → одно),
// вызов функции-строителя (`celebratedKey(day)` → её return). Всё остальное
// (параметр функции, переменная цикла, `window.x`) — «неразрешимо»: для
// обычного файла это красное, для объявленного движка — норма.
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve, relative } from 'path';
import { stripComments } from './gate-strip-comments.mjs';
import {
  constInitializer,
  functionValueExpr,
  matchBracket,
  objectEntries,
  splitTopLevel,
  unwrap,
} from './local-cache-source.mjs';

const MAX_DEPTH = 8;
const IDENT = /^[A-Za-z_$][\w$]*$/;

/** Файл по относительному импорту: .ts/.tsx/index.*; null — не локальный модуль. */
export function resolveImportPath(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec.replace(/\.(js|ts|tsx)$/, ''));
  for (const cand of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/** Импорты файла: локальное имя → { file, name } (только относительные модули). */
export function importMap(file, src) {
  const map = new Map();
  const re = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const target = resolveImportPath(file, m[2]);
    if (!target) continue;
    for (const part of m[1].split(',')) {
      const seg = part.trim().replace(/^type\s+/, '');
      if (!seg) continue;
      const [name, local = name] = seg.split(/\s+as\s+/).map((s) => s.trim());
      map.set(local, { file: target, name });
    }
  }
  return map;
}

/** Файл, где `name` объявлен как `export const`/`function` — через реэкспорты. */
function findExportSource(ctx, file, name, seen = new Set()) {
  if (seen.has(file)) return null;
  seen.add(file);
  const src = ctx.load(file);
  if (src === null) return null;
  if (new RegExp(`(?:^|[^\\w$.])export\\s+(?:const|let|function)\\s+${name}\\b`, 'm').test(src)) return file;
  const named = /export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = named.exec(src))) {
    for (const part of m[1].split(',')) {
      const [orig, local = orig] = part.trim().split(/\s+as\s+/).map((s) => s.trim());
      if (local !== name) continue;
      const target = resolveImportPath(file, m[2]);
      const found = target && findExportSource(ctx, target, orig, seen);
      if (found) return { file: found, name: orig };
    }
  }
  const star = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = star.exec(src))) {
    const target = resolveImportPath(file, m[1]);
    const found = target && findExportSource(ctx, target, name, seen);
    if (found) return found;
  }
  return null;
}

function fail(reason) {
  return { keys: [], error: reason };
}

/**
 * Ключи, которые записывает выражение expr в файле file.
 * ctx: { load(file) → stripped-source|null }. Возвращает { keys, error? }.
 */
export function resolveKeyExpr(expr, file, ctx, depth = 0) {
  if (depth > MAX_DEPTH) return fail('слишком глубокая цепочка констант');
  const e = unwrap(expr);
  const src = ctx.load(file);
  if (src === null) return fail(`файл не прочитан: ${relative(ctx.root, file)}`);
  const lit = /^(['"])((?:\\.|(?!\1).)*)\1$/.exec(e);
  if (lit) return { keys: [lit[2]] };
  if (e.startsWith('`') && e.endsWith('`') && e.length >= 2) {
    const body = e.slice(1, -1);
    const hole = body.indexOf('${');
    if (hole === -1) return { keys: [body] };
    if (hole === 0) return fail('шаблонный ключ без литерального префикса');
    return { keys: [`${body.slice(0, hole)}*`] };
  }
  const ternary = splitTopLevel(e, '?');
  if (ternary.length === 2) {
    const [, rest] = ternary;
    const branches = splitTopLevel(rest, ':');
    if (branches.length === 2) return union(branches.map((b) => resolveKeyExpr(b, file, ctx, depth + 1)));
  }
  const sum = splitTopLevel(e, '+');
  if (sum.length > 1) {
    const head = resolveKeyExpr(sum[0], file, ctx, depth + 1);
    if (head.error) return head;
    return { keys: head.keys.map((k) => (k.endsWith('*') ? k : `${k}*`)) };
  }
  const call = /^([A-Za-z_$][\w$]*)\s*\(/.exec(e);
  if (call && matchBracket(e, call[0].length - 1) === e.length - 1) {
    return resolveNamed(call[1], file, ctx, depth, (defFile, defSrc) => {
      const value = functionValueExpr(defSrc, call[1]);
      return value === null ? fail(`у функции ${call[1]} нет return с ключом`) : resolveKeyExpr(value, defFile, ctx, depth + 1);
    });
  }
  const member = /^([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*)|\[(.+)\])$/.exec(e);
  if (member) {
    return resolveNamed(member[1], file, ctx, depth, (defFile, defSrc) => {
      const init = constInitializer(defSrc, member[1]);
      const obj = init === null ? null : unwrap(init);
      if (!obj || !obj.startsWith('{')) return fail(`${member[1]} — не объектный литерал`);
      const entries = objectEntries(obj);
      const prop = member[2] ?? (/^(['"])(.*)\1$/.exec(member[3].trim()) ?? [])[2];
      const picked = prop === undefined ? entries : entries.filter((en) => en.name === prop);
      if (picked.length === 0) return fail(`в ${member[1]} нет поля ${prop}`);
      return union(picked.map((en) => resolveKeyExpr(en.expr, defFile, ctx, depth + 1)));
    });
  }
  if (IDENT.test(e)) {
    return resolveNamed(e, file, ctx, depth, (defFile, defSrc) => {
      const init = constInitializer(defSrc, e);
      return init === null ? fail(`${e} — не константа (параметр или внешняя переменная)`) : resolveKeyExpr(init, defFile, ctx, depth + 1);
    });
  }
  return fail(`выражение не разобрано: ${e.slice(0, 60)}`);
}

/** Имя — локальное объявление или импорт; onFound(файл, текст) разбирает его. */
function resolveNamed(name, file, ctx, depth, onFound) {
  const src = ctx.load(file);
  const localDecl = new RegExp(`(?:^|[^\\w$.])(?:const|let|function)\\s+${name}\\b`, 'm').test(src);
  if (localDecl) return onFound(file, src);
  const imp = importMap(file, src).get(name);
  if (!imp) return fail(`${name} — не константа (параметр или внешняя переменная)`);
  const found = findExportSource(ctx, imp.file, imp.name);
  if (!found) return fail(`${name}: экспорт не найден по цепочке импортов`);
  const defFile = typeof found === 'string' ? found : found.file;
  const defName = typeof found === 'string' ? imp.name : found.name;
  if (defName !== name) return resolveKeyExpr(defName, defFile, ctx, depth + 1);
  return onFound(defFile, ctx.load(defFile));
}

function union(results) {
  const err = results.find((r) => r.error);
  if (err) return err;
  return { keys: [...new Set(results.flatMap((r) => r.keys))] };
}

/** Контекст с кэшем прочитанных файлов (комментарии стёрты). */
export function makeContext(root) {
  const cache = new Map();
  return {
    root,
    load(file) {
      if (!cache.has(file)) {
        try {
          cache.set(file, stripComments(readFileSync(file, 'utf8')));
        } catch {
          cache.set(file, null);
        }
      }
      return cache.get(file);
    },
  };
}
