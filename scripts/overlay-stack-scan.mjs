// Разбор для check-overlay-stack.mjs: карта CSS-классов полноэкранных
// оверлеев и JSX-теги с их z-index. Вынесено из гейта, чтобы сам гейт
// остался в лимите размера (правило №10); gate-sandbox.ts копирует
// локальные `./*.mjs`-зависимости в песочницу.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { stripComments } from './gate-strip-comments.mjs';

/** `.класс` → z-index для полноэкранных правил: `position: fixed`,
 * `inset: 0` (тот же признак, что у check-history-sheet.mjs — меню и баннеры
 * с `position: fixed` без inset листами не являются) и `z-index: N`. */
export function cssOverlayMap(cssFiles) {
  const map = new Map();
  for (const file of cssFiles) {
    const css = stripComments(readFileSync(file, 'utf8'), true);
    // Внутренние блоки `селектор { тело }`; обёртка @media сама не матчится,
    // её вложенные правила — матчатся по одному.
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const body = m[2];
      if (
        !/position\s*:\s*fixed\b/.test(body) ||
        !/\binset\s*:\s*0\b/.test(body)
      )
        continue;
      const z = body.match(/z-index\s*:\s*(-?\d+)/);
      if (!z) continue;
      for (const sel of m[1].split(',')) {
        const cls = sel.trim().match(/^\.([\w-]+)$/);
        if (cls && !map.has(cls[1])) map.set(cls[1], Number(z[1]));
      }
    }
  }
  return map;
}

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

/** Локальное имя → путь файла для импортов относительным путём
 * (`import { A, B as C } from './x'`, `import D from './x'`, а также
 * `lazy(() => import('./x').then((m) => ({ default: m.Y })))`). */
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
        if (orig) names.set(local ?? orig, origin(target, orig));
      }
    }
    const def = clause
      .replace(/\{[^}]*\}/, '')
      .replace(/,/g, '')
      .trim();
    if (/^[A-Za-z_$][\w$]*$/.test(def)) names.set(def, target);
  }
  for (const m of src.matchAll(
    /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\('(\.[^']*)'\)/g,
  )) {
    const target = resolveImport(file, m[2]);
    if (target) names.set(m[1], target);
  }
  return names;
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

/** Открывающие JSX-теги файла по порядку: имя, строка, явный zIndex, класс
 * из карты, самозакрытость. */
/** Дефолт пропа `zIndex = N` в сигнатуре компонента: его z, когда потребитель
 * ничего не передал (`CrisisContactsSheet({ onClose, zIndex = 320 })`). */
export function defaultPropZ(src) {
  const m = src.match(/[{,]\s*zIndex\s*=\s*(\d+)\s*[,}]/);
  return m ? Number(m[1]) : null;
}

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
      line: src.slice(0, m.index).split('\n').length,
      explicitZ: z ? Number(z[1]) : null,
      // `zIndex={zIndex}` — число пришло пропом, здесь оно неизвестно.
      zPassedThrough: !z && /\bzIndex=\{/.test(attrs),
      classZ: classZ ?? null,
      selfClosing: attrs.trimEnd().endsWith('/'),
    });
  }
  return tags;
}
