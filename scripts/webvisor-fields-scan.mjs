// Разбор исходников для check-webvisor-fields.mjs: корни (страницы визитки),
// обход импортов и поиск текстовых <input>/<textarea> в JSX. Вынесено из
// движка гейта (правило №10) — движок только собирает отчёт.
import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { stripComments } from './gate-strip-comments.mjs';

// Типы поля, где нет ввода текста: Вебвизор пишет только клавиши в текстовых
// полях, а у этих типов вводимое — выбор, не текст. `number` в списке НЕТ намеренно:
// политика обещает «содержимое полей ввода не записывается» без исключений, а
// сумма доната (/donate) доступна без перезагрузки из главной, где запись идёт.
const NON_TEXT_TYPES = new Set([
  'checkbox', 'radio', 'range', 'hidden', 'file', 'submit', 'button', 'reset', 'image', 'color',
]);
export const MARKER_KEYS = 'ym-disable-keys';
export const MARKER_HIDE = 'ym-hide-content';

const read = (root, rel) => stripComments(readFileSync(join(root, rel), 'utf8'), false);

/** Тело блока `<open> … <close>` по балансу скобок, начиная с первого `open`. */
function block(text, open, openCh, closeCh) {
  const at = text.indexOf(open);
  if (at === -1) return '';
  let depth = 0;
  for (let i = text.indexOf(openCh, at + open.length - 1); i < text.length; i++) {
    if (text[i] === openCh) depth++;
    else if (text[i] === closeCh && --depth === 0) return text.slice(at, i + 1);
  }
  return '';
}

/** Имена импортированных относительным путём компонентов App.tsx → файл (от корня). */
function importMap(root, appRel, appText) {
  const map = new Map();
  const dir = dirname(appRel);
  for (const m of appText.matchAll(/import\s+(?:(\w+)|\{([^}]*)\})\s+from\s+'(\.[^']+)'/g)) {
    const names = m[1] ? [m[1]] : m[2].split(',').map((s) => s.split(/\s+as\s+/).pop().trim()).filter(Boolean);
    for (const n of names) map.set(n, resolveFile(root, dir, m[3]));
  }
  // lazy(() => import('./pages/X').then(m => ({ default: m.X })))
  for (const m of appText.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\('(\.[^']+)'\)/g)) {
    map.set(m[1], resolveFile(root, dir, m[2]));
  }
  return map;
}

export function resolveFile(root, fromDir, spec) {
  const base = join(fromDir, spec);
  for (const cand of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts'), base]) {
    if (/\.tsx?$/.test(cand) && existsSync(join(root, cand)) && statSync(join(root, cand)).isFile()) return cand;
  }
  return null;
}

/**
 * Корни обхода: компоненты в `personalRoutes` (страницы визитки) и в `Root`
 * (рендерится вокруг каждой страницы, например баннер cookie).
 */
export function routeRoots(root, appRel) {
  const app = read(root, appRel);
  const scope = block(app, 'const personalRoutes = [', '[', ']') + block(app, 'function Root()', '{', '}');
  const imports = importMap(root, appRel, app);
  const names = new Set([...scope.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1]));
  return { files: [...names].map((n) => imports.get(n)).filter(Boolean), names: [...names] };
}

/** Относительные импорты файла (статические и `import('…')`). */
export function relativeImports(root, rel, text) {
  const out = [];
  for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)'(\.[^']+)'/g)) {
    const f = resolveFile(root, dirname(rel), m[1]);
    if (f) out.push(f);
  }
  return out;
}

/** Конец открывающего тега, начиная с позиции `<`: учитывает строки и {выражения}. */
function tagEnd(text, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return text.length;
}

/** Текстовые поля без метки: [{ line, tag }]. */
export function unmarkedFields(text) {
  const found = [];
  for (const m of text.matchAll(/<(input|textarea)(?=[\s/>])/g)) {
    const tag = text.slice(m.index, tagEnd(text, m.index) + 1);
    const type = tag.match(/(?<![\w-])type\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*['"]([^'"]*)['"]\s*\})/);
    const typeName = type ? (type[1] ?? type[2] ?? type[3]).toLowerCase() : null;
    if (m[1] === 'input' && typeName && NON_TEXT_TYPES.has(typeName)) continue;
    if (/\baria-hidden\b/.test(tag)) continue; // honeypot: человек в него не пишет
    if (tag.includes(MARKER_KEYS)) continue;
    found.push({ line: text.slice(0, m.index).split('\n').length, tag: tag.replace(/\s+/g, ' ').slice(0, 90) });
  }
  return found;
}

export function loadStripped(root, rel) {
  return read(root, rel);
}
