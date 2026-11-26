#!/usr/bin/env node
// Храповик «своя кнопка» (аудит дизайна 2026-11, Г6): CSS-правило, в селекторе которого
// btn|cta|submit, задаёт и фон, и скругление вне .ds-btn… — это новая кнопка рядом с
// примитивом (cabinet.css). Кнопка — `ds-btn` + модификатор; класс страницы отвечает
// только за раскладку. Пофайловый храповик, новый файл рождается с нулём.
// Снизил — `--update`; что насчитано — `--verbose`. Тест — src/test-support/gates/own-button.spec.ts.
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { parseCssRules } from './css-rules-parse.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'own-button-baseline.json');
const SCAN_DIRS = ['webapp/src', 'shared/src'];

/** Часть селектора — «кнопка не из примитива»: btn|cta|submit в имени, .ds-btn не в составе. */
const isOwnButton = (part) => /btn|cta|submit/i.test(part) && !part.includes('.ds-btn');
const hasFill = (d) => 'background' in d || 'background-color' in d;

/** Попадания файла: [{ line, selector }]. */
export function findOwnButtons(css) {
  const hits = [];
  for (const r of parseCssRules(stripComments(css, true))) {
    if (!hasFill(r.decls) || !('border-radius' in r.decls)) continue;
    const parts = r.selector.split(',').map((p) => p.trim());
    if (parts.some(isOwnButton)) hits.push({ line: r.line, selector: r.selector });
  }
  return hits;
}

const cssFiles = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
    .flatMap((e) => (e.isDirectory() ? cssFiles(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))
    .filter((f) => f.endsWith('.css'))
    .sort();

function main() {
  const counts = {};
  const details = {};
  for (const file of SCAN_DIRS.flatMap(cssFiles)) {
    const hits = findOwnButtons(readFileSync(join(ROOT, file), 'utf8'));
    if (!hits.length) continue;
    counts[file] = hits.length;
    details[file] = hits.map((h) => `  L${h.line} ${h.selector}`);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (process.argv.includes('--update')) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`Бейслайн обновлён: ${total} своих кнопок в ${Object.keys(counts).length} файлах.`);
    return;
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  if (process.argv.includes('--verbose')) for (const f of Object.keys(details)) console.log(`${f}\n${details[f].join('\n')}`);
  const grown = Object.keys(counts).filter((f) => counts[f] > (baseline[f] ?? 0));
  if (grown.length) {
    console.error('❌ Своя кнопка (фон и скругление в правиле с btn|cta|submit вне .ds-btn):\n');
    for (const f of grown) console.error(`  ${f}: ${counts[f]} (допустимо ${baseline[f] ?? 0})\n${details[f].join('\n')}`);
    console.error(
      '\nВозьми примитив: className="ds-btn" (+ --secondary, --icon, --sm, --lg), класс страницы — только раскладка.\n' +
        'Снизил счётчик — зафиксируй: node scripts/check-own-button.mjs --update',
    );
    process.exit(1);
  }
  console.log(`✓ свои кнопки: ${total} (без роста)`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
