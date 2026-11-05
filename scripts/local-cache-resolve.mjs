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

const MAX_DEPTH = 8;
const IDENT = /^[A-Za-z_$][\w$]*$/;

/** Индекс символа после строкового/шаблонного литерала, начавшегося в i. */
export function skipString(src, i) {
  const quote = src[i];
  i += 1;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === quote) return i;
    i += 1;
  }
  return i;
}

/** Индекс закрывающей скобки, парной открывающей на openIndex ((, [ или {). */
export function matchBracket(src, openIndex) {
  const open = src[openIndex];
  const close = open === '(' ? ')' : open === '[' ? ']' : '}';
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i); continue; }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Разбивает текст на части по разделителю верхнего уровня (запятая, `+`, `?`). */
export function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(text, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (depth === 0 && c === sep) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim());
}

/** Текст инициализатора после `=`: до `;` верхнего уровня. */
function readInitializer(src, from) {
  let depth = 0;
  for (let i = from; i < src.length && i - from < 4000; i += 1) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(src, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ';' && depth === 0) return src.slice(from, i);
  }
  return src.slice(from, from + 4000);
}

/** Первое `return <expr>;` в теле функции (между фигурными скобками). */
function returnExpr(body) {
  const m = /\breturn\s+/.exec(body);
  if (!m) return null;
  return readInitializer(body, m.index + m[0].length).trim();
}

/** Выражение-значение функции с именем name в файле: return или тело стрелки. */
function functionValueExpr(src, name) {
  const decl = new RegExp(`(?:^|[^\\w$.])function\\s+${name}\\s*(?:<[^(]*>)?\\s*\\(`, 'm').exec(src);
  if (decl) {
    const paren = decl.index + decl[0].length - 1;
    const close = matchBracket(src, paren);
    const brace = close === -1 ? -1 : src.indexOf('{', close);
    if (brace === -1) return null;
    const end = matchBracket(src, brace);
    return end === -1 ? null : returnExpr(src.slice(brace + 1, end));
  }
  const init = constInitializer(src, name);
  if (init === null) return null;
  const arrow = init.indexOf('=>');
  if (arrow === -1) return null;
  const body = init.slice(arrow + 2).trim();
  if (body.startsWith('{')) {
    const end = matchBracket(body, 0);
    return end === -1 ? null : returnExpr(body.slice(1, end));
  }
  return body;
}

/** Инициализатор `const NAME = …` (с опциональной аннотацией типа) или null. */
function constInitializer(src, name) {
  const re = new RegExp(
    `(?:^|[^\\w$.])(?:export\\s+)?(?:const|let)\\s+${name}\\b\\s*(?::\\s*[^=;]+?)?\\s*=(?!=)\\s*`,
    'm',
  );
  const m = re.exec(src);
  return m ? readInitializer(src, m.index + m[0].length) : null;
}

/** Строка после `as …`/`satisfies …` и внешних скобок убирается. */
function unwrap(expr) {
  let e = expr.trim();
  for (;;) {
    const next = e.replace(/\s+(?:as|satisfies)\s+[\w<>[\]|'" ,]+$/, '').trim();
    if (next !== e) { e = next; continue; }
    if (e.startsWith('(') && matchBracket(e, 0) === e.length - 1) { e = e.slice(1, -1).trim(); continue; }
    return e;
  }
}

/** Пары `имя: выражение` объектного литерала `{ … }`. */
function objectEntries(literal) {
  const inner = literal.slice(1, matchBracket(literal, 0));
  return splitTopLevel(inner, ',')
    .filter(Boolean)
    .map((entry) => {
      const colon = entry.search(/:(?!:)/);
      if (colon === -1) return { name: entry.trim(), expr: entry.trim() };
      return { name: entry.slice(0, colon).trim().replace(/^['"]|['"]$/g, ''), expr: entry.slice(colon + 1).trim() };
    });
}

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
