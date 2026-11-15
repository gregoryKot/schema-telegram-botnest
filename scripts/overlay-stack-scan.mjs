// Разбор для check-overlay-stack.mjs: импорты и JSX-теги с их z-index (карта
// CSS-классов — overlay-stack-css.mjs). Вынесено из гейта ради лимита размера
// (правило №10); gate-sandbox.ts копирует локальные `./*.mjs` в песочницу.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';

export function walkTsx(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist') walkTsx(p, acc);
    } else if (name.endsWith('.tsx') && !/\.(spec|test)\.tsx$/.test(name))
      acc.push(p);
  }
  return acc;
}

function resolveImport(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const cand of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

const reexportCache = new Map();
/** `export { A, B as C } from './x'` в файле: имя → файл-источник. */
function reexports(file) {
  if (!reexportCache.has(file)) {
    const map = new Map();
    let src = '';
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      /* нет файла — нет реэкспортов */
    }
    for (const m of src.matchAll(
      /export\s+\{([^}]*)\}\s+from\s+'(\.[^']*)'/g,
    )) {
      const target = resolveImport(file, m[2]);
      if (!target) continue;
      for (const part of m[1].split(',')) {
        const nm = part
          .trim()
          .split(/\s+as\s+/)
          .pop();
        if (nm) map.set(nm, target);
      }
    }
    reexportCache.set(file, map);
  }
  return reexportCache.get(file);
}

/** Файл, где имя объявлено на самом деле (реэкспорт `SsHead` из SsSheet.tsx
 * ведёт в SsHead.tsx, а не к z-index оболочки). */
function origin(file, name, depth = 0) {
  const next = reexports(file).get(name);
  return next && depth < 5 ? origin(next, name, depth + 1) : file;
}

/** Локальное имя → `{ file, name }` (файл и имя экспорта; null — дефолтный)
 * для импортов относительным путём (`import { A, B as C } from './x'`,
 * `import D from './x'`, `lazy(() => import('./x').then((m) => ({ default: m.Y })))`). */
export function relativeImports(file, src) {
  const names = new Map();
  for (const m of src.matchAll(/import\s+([^'";]+?)\s+from\s+'(\.[^']*)'/g)) {
    const target = resolveImport(file, m[2]);
    if (!target) continue;
    const clause = m[1].replace(/^type\s+/, '');
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const [orig, local] = part
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/);
        if (orig)
          names.set(local ?? orig, { file: origin(target, orig), name: orig });
      }
    }
    const def = clause
      .replace(/\{[^}]*\}/, '')
      .replace(/,/g, '')
      .trim();
    if (/^[A-Za-z_$][\w$]*$/.test(def))
      names.set(def, { file: target, name: null });
  }
  for (const m of src.matchAll(
    /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\('(\.[^']*)'\)(?:\.then\(\s*\(?\s*\w+\s*\)?\s*=>\s*\(\{\s*default:\s*\w+\.(\w+))?/g,
  )) {
    const target = resolveImport(file, m[2]);
    if (target)
      names.set(m[1], {
        file: m[3] ? origin(target, m[3]) : target,
        name: m[3] ?? null,
      });
  }
  return names;
}

/** Объявления верхнего уровня (`function X`, `const X =`, с `export`): имя и
 * границы — до следующего объявления; в них ищут оболочку компонента X. */
export function topDecls(src) {
  const ms = [
    ...src.matchAll(
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*|const\s+|let\s+|class\s+)([\w$]*)/gm,
    ),
  ];
  return ms.map((m, i) => ({
    name: m[1],
    from: m.index,
    to: ms[i + 1]?.index ?? src.length,
  }));
}

/** Атрибуты открывающего JSX-тега: от имени до `>` на нулевой глубине скобок.
 * Самозакрывающийся тег (`<X … />`) — ребёнок, а не оболочка. */
function tagAttrs(src, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{' || c === '(') depth++;
    else if (c === '}' || c === ')') depth--;
    else if (c === '>' && depth <= 0) return src.slice(from, i);
  }
  return src.slice(from);
}

/** Дефолт пропа `zIndex = N` в сигнатуре компонента: его z, когда потребитель
 * ничего не передал (`CrisisContactsSheet({ onClose, zIndex = 320 })`). */
export function defaultPropZ(src) {
  const m = src.match(/[{,]\s*zIndex\s*=\s*(\d+)\s*[,}]/);
  return m ? Number(m[1]) : null;
}

/** Открывающие JSX-теги файла по порядку: имя, позиция, строка, явный zIndex,
 * класс из карты, самозакрытость. */
export function jsxTags(src, cssMap) {
  const tags = [];
  for (const m of src.matchAll(/<([A-Za-z][\w.-]*)(?=[\s/>])/g)) {
    const attrs = tagAttrs(src, m.index + m[0].length);
    const z = attrs.match(/\bzIndex=\{\s*(\d+)\s*\}/);
    const cn = attrs.match(/className=(?:"([^"]*)"|\{\s*['"`]([^'"`$]*))/);
    const classZ = (cn?.[1] ?? cn?.[2] ?? '')
      .split(/\s+/)
      .map((c) => cssMap.get(c))
      .find((v) => v !== undefined);
    tags.push({
      name: m[1],
      index: m.index,
      line: src.slice(0, m.index).split('\n').length,
      explicitZ: z ? Number(z[1]) : null,
      // `zIndex={zIndex}`, `style={{ zIndex }}` — число задаёт код, здесь оно неизвестно.
      zPassedThrough: !z && /\bzIndex\b/.test(attrs),
      classZ: classZ ?? null,
      selfClosing: attrs.trimEnd().endsWith('/'),
    });
  }
  return tags;
}
