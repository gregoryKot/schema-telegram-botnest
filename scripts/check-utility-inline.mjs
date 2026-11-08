#!/usr/bin/env node
// Храповик «инлайновый набор свойств, для которого уже есть класс-утилита»
// (docs/open/frontend-ux.md; утилиты — shared/src/theme/utilities.css).
//
// Утилиты завели под наборы, встречавшиеся в коде ≥6 раз: класс пишется в CSS
// один раз, а инлайновый объект каждое место несёт своей копией (бандл, дрейф
// значений). Но гейта не оставили, и новый код снова пишет
// `style={{ display: 'flex', alignItems: 'center', gap: 8 }}` вместо `u-ac8`.
//
// Считается объект `style={{…}}` в .tsx (webapp/src, shared/src), набор свойств
// которого ТОЧНО совпадает с одной утилитой: те же свойства, те же значения
// (число → px, кроме безразмерных; `var(--space-N)` → его px из tokens.css).
// Объект с лишним свойством, спредом или вычисляемым значением не считается:
// переводить его в класс — решение, а не механика. Пофайловый храповик, новый
// файл рождается с нулём. Снизил — `--update`; что насчитано — `--verbose`.
// Тест — src/test-support/gates/utility-inline.spec.ts.
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { parseCssRules } from './css-rules-parse.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'utility-inline-baseline.json');
const UTILITIES = 'shared/src/theme/utilities.css';
const TOKENS = 'shared/src/theme/tokens.css';
const SCAN_DIRS = ['webapp/src', 'shared/src'];
const UNITLESS = new Set(['flex', 'font-weight', 'line-height', 'opacity', 'z-index', 'flex-grow', 'flex-shrink', 'order']);

const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
/** Значение к сравнимому виду: px из шкалы, числа с единицей, без кавычек. */
export function normValue(prop, raw, scale) {
  let v = String(raw).trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  v = v.replace(/var\(\s*(--space-\d+)\s*\)/g, (m, name) => scale[name] ?? m);
  if (/^-?\d+(\.\d+)?$/.test(v) && !UNITLESS.has(prop) && v !== '0') v += 'px';
  return v.replace(/\s+/g, ' ');
}
const keyOf = (decls) =>
  Object.entries(decls)
    .map(([p, v]) => `${p}:${v}`)
    .sort()
    .join(';');

export function spaceScale(tokensCss) {
  return Object.fromEntries([...tokensCss.matchAll(/(--space-\d+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** Утилиты: Map ключ-набора → имя класса. Селектор вида `.u-x.u-x`. */
export function utilityKeys(utilitiesCss, scale) {
  const out = new Map();
  for (const r of parseCssRules(stripComments(utilitiesCss, true))) {
    const m = /^\.(u-[\w-]+)\.\1$/.exec(r.selector.trim());
    if (!m || r.ctx.length) continue;
    const decls = Object.fromEntries(Object.entries(r.decls).map(([p, v]) => [p, normValue(p, v, scale)]));
    out.set(keyOf(decls), m[1]);
  }
  return out;
}

function closeBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < s.length && s[i] !== c; i++) if (s[i] === '\\') i++;
    } else if (c === '{' || c === '(' || c === '[') depth++;
    else if ((c === '}' || c === ')' || c === ']') && --depth === 0) return i;
  }
  return -1;
}

/** Набор свойств литерала `{…}` или null, если в нём спред/выражение/шаблон. */
export function literalDecls(body, scale) {
  const decls = {};
  for (const part of body.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^([A-Za-z]+)\s*:\s*(-?\d+(?:\.\d+)?|'[^'`$]*'|"[^"`$]*")$/.exec(part);
    if (!m) return null;
    const prop = kebab(m[1]);
    decls[prop] = normValue(prop, m[2], scale);
  }
  return Object.keys(decls).length ? decls : null;
}

/** Попадания файла: [{ line, util }]. */
export function findUtilityInline(src, utils, scale) {
  const code = stripComments(src, false);
  const hits = [];
  for (const m of code.matchAll(/\bstyle=\{\{/g)) {
    const open = m.index + m[0].length - 1;
    const close = closeBrace(code, open);
    if (close < 0) continue;
    const body = code.slice(open + 1, close);
    const decls = literalDecls(body, scale);
    const util = decls && utils.get(keyOf(decls));
    if (util) hits.push({ line: code.slice(0, m.index).split('\n').length, util });
  }
  return hits;
}

const tsxFiles = (dir) =>
  readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(e.name))
    .filter((e) => !(e.parentPath ?? e.path).includes('node_modules'))
    .map((e) => join(e.parentPath ?? e.path, e.name).slice(ROOT.length + 1))
    .sort();

function main() {
  const scale = spaceScale(readFileSync(join(ROOT, TOKENS), 'utf8'));
  const utils = utilityKeys(readFileSync(join(ROOT, UTILITIES), 'utf8'), scale);
  const counts = {};
  const details = {};
  for (const file of SCAN_DIRS.flatMap(tsxFiles)) {
    const hits = findUtilityInline(readFileSync(join(ROOT, file), 'utf8'), utils, scale);
    if (!hits.length) continue;
    counts[file] = hits.length;
    details[file] = hits.map((h) => `  L${h.line} → className="${h.util}"`);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (process.argv.includes('--update')) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`Бейслайн обновлён: ${total} наборов-утилит инлайном в ${Object.keys(counts).length} файлах.`);
    return;
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  if (process.argv.includes('--verbose')) for (const f of Object.keys(details)) console.log(`${f}\n${details[f].join('\n')}`);
  const grown = Object.keys(counts).filter((f) => counts[f] > (baseline[f] ?? 0));
  if (grown.length) {
    console.error('❌ Инлайновый набор свойств, для которого есть класс-утилита:\n');
    for (const f of grown) console.error(`  ${f}: ${counts[f]} (допустимо ${baseline[f] ?? 0})\n${details[f].join('\n')}`);
    console.error(
      `\nНабор целиком совпадает с утилитой из ${UTILITIES}: замени style={{…}} на className.\n` +
        'Снизил счётчик — зафиксируй: node scripts/check-utility-inline.mjs --update',
    );
    process.exit(1);
  }
  console.log(`✓ инлайн вместо утилиты: ${total} (без роста)`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
